"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getBaseCurrency } from "@/lib/currency";
import { executeCapitalSnapshot } from "@/lib/capitalSnapshotJob";
import { reconcileManualVaultBalancesIfDue } from "@/lib/manualBalanceReconcile";
import type {
  CapitalGrowthMetrics,
  CapitalHistoryDay,
  HistoryPeriodMonths,
  MonthlyCapitalRow,
} from "@/types/capitalHistory";

export type {
  CapitalGrowthMetrics,
  CapitalHistoryDay,
  CapitalHistoryVaultSlice,
  HistoryPeriodMonths,
  MonthlyCapitalRow,
} from "@/types/capitalHistory";

function historySinceDate(months: number | "all"): Date {
  if (months === "all") return new Date(0);
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthRuFromKey(monthKey: string): string {
  const [ys, ms] = monthKey.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  const d = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(d);
}

function buildMonthCloseMap(history: CapitalHistoryDay[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const row of history) {
    const [ys, ms] = row.date.split("-").map(Number);
    if (!Number.isFinite(ys) || !Number.isFinite(ms)) continue;
    const mk = `${ys}-${String(ms).padStart(2, "0")}`;
    m.set(mk, row.total);
  }
  return m;
}

function rollingMonthKeys(count: number): string[] {
  const d = new Date();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(monthKeyFromDate(x));
  }
  return keys;
}

function computeGrowthFromHistory(
  history: CapitalHistoryDay[],
  baseCurrency: string
): CapitalGrowthMetrics {
  if (history.length === 0) {
    return {
      startValue: 0,
      currentValue: 0,
      absoluteGrowth: 0,
      percentGrowth: null,
      bestMonth: null,
      worstMonth: null,
      currency: baseCurrency,
    };
  }

  const startValue = history[0].total;
  const currentValue = history[history.length - 1].total;
  const absoluteGrowth = currentValue - startValue;
  const percentGrowth =
    startValue !== 0 && Number.isFinite(startValue) ? ((currentValue - startValue) / startValue) * 100 : null;

  const monthClose = buildMonthCloseMap(history);
  const sortedMonths = [...monthClose.keys()].sort();
  let bestMonth: { label: string; delta: number } | null = null;
  let worstMonth: { label: string; delta: number } | null = null;
  let prevClose: number | undefined;

  for (const mk of sortedMonths) {
    const close = monthClose.get(mk);
    if (close === undefined) continue;
    if (prevClose !== undefined) {
      const delta = close - prevClose;
      const label = formatMonthRuFromKey(mk);
      if (!bestMonth || delta > bestMonth.delta) bestMonth = { label, delta };
      if (!worstMonth || delta < worstMonth.delta) worstMonth = { label, delta };
    }
    prevClose = close;
  }

  return {
    startValue,
    currentValue,
    absoluteGrowth,
    percentGrowth,
    bestMonth,
    worstMonth,
    currency: baseCurrency,
  };
}

/**
 * Тихий автоснимок при загрузке layout (без self-fetch).
 */
export async function tryTakeSnapshot(): Promise<void> {
  try {
    await reconcileManualVaultBalancesIfDue();
    await executeCapitalSnapshot();
  } catch {
    /* намеренно пусто */
  }
}

export async function takeCapitalSnapshot(): Promise<{
  created: number;
  skipped: number;
  error?: string;
}> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) {
      return { created: 0, skipped: 0, error: "Не удалось определить адрес сервера." };
    }
    const proto = h.get("x-forwarded-proto") ?? "http";
    const res = await fetch(`${proto}://${host}/api/snapshot-capital`, {
      method: "POST",
      cache: "no-store",
    });
    const json = (await res.json()) as { created?: number; skipped?: number; error?: string };
    if (!res.ok) {
      return {
        created: 0,
        skipped: 0,
        error: typeof json.error === "string" ? json.error : `Ошибка ${res.status}`,
      };
    }
    return {
      created: Number(json.created ?? 0),
      skipped: Number(json.skipped ?? 0),
    };
  } catch (e) {
    return {
      created: 0,
      skipped: 0,
      error: e instanceof Error ? e.message : "Сеть или сервер недоступны.",
    };
  }
}

export async function getCapitalHistory(months: number | "all" = 12): Promise<CapitalHistoryDay[]> {
  const since = historySinceDate(months);

  const snapshots = await prisma.vaultSnapshot.findMany({
    where: {
      date: { gte: since },
      vault: { includeInNetWorth: true },
    },
    orderBy: [{ date: "asc" }, { vaultId: "asc" }],
    include: { vault: { select: { name: true } } },
  });

  type DayAgg = {
    total: number;
    byVault: Map<string, { name: string; balance: number }>;
  };

  const byDay = new Map<string, DayAgg>();

  for (const s of snapshots) {
    const day = s.date.toISOString().slice(0, 10);
    let agg = byDay.get(day);
    if (!agg) {
      agg = { total: 0, byVault: new Map() };
      byDay.set(day, agg);
    }
    agg.total += s.balance;
    const prev = agg.byVault.get(s.vaultId)?.balance ?? 0;
    agg.byVault.set(s.vaultId, {
      name: s.vault.name,
      balance: prev + s.balance,
    });
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, agg]) => ({
      date,
      total: agg.total,
      byVault: Array.from(agg.byVault.entries())
        .map(([vaultId, { name, balance }]) => ({ vaultId, name, balance }))
        .sort((x, y) => x.name.localeCompare(y.name, "ru")),
    }));
}

export async function getCapitalGrowth(months: number | "all" = 12): Promise<CapitalGrowthMetrics> {
  const [history, baseCurrency] = await Promise.all([getCapitalHistory(months), getBaseCurrency()]);
  return computeGrowthFromHistory(history, baseCurrency);
}

export async function getMonthlyCapitalTableRows(): Promise<MonthlyCapitalRow[]> {
  const daily = await getCapitalHistory(240);
  const monthClose = buildMonthCloseMap(daily);
  const keys = rollingMonthKeys(12);
  const rows: MonthlyCapitalRow[] = [];

  const [fy, fm] = keys[0].split("-").map(Number);
  const beforeFirst = new Date(fy, fm - 2, 1);
  const beforeKey = monthKeyFromDate(beforeFirst);
  let prevEnd: number | null = monthClose.get(beforeKey) ?? null;

  for (const mk of keys) {
    const rawEnd = monthClose.get(mk);
    const endVal = rawEnd !== undefined ? rawEnd : prevEnd ?? 0;
    const startVal = prevEnd !== null ? prevEnd : endVal;
    const change = endVal - startVal;
    const percentChange = startVal !== 0 ? (change / startVal) * 100 : null;
    rows.push({
      monthKey: mk,
      label: formatMonthRuFromKey(mk),
      startBalance: startVal,
      endBalance: endVal,
      change,
      percentChange,
    });
    prevEnd = endVal;
  }

  return rows;
}

/** Для мини-графика: последние `days` точек из истории за ~1 календарный месяц. */
export async function getCapitalHistoryLastDays(days: number): Promise<CapitalHistoryDay[]> {
  const h = await getCapitalHistory(1);
  if (h.length <= days) return h;
  return h.slice(-days);
}

/** Данные для виджета «Динамика капитала» на главной. */
export async function getCapitalWidgetStats(): Promise<{
  last30: CapitalHistoryDay[];
  monthDelta: number;
  currency: string;
}> {
  const [last30, baseCurrency] = await Promise.all([getCapitalHistoryLastDays(30), getBaseCurrency()]);
  const monthDelta =
    last30.length >= 2 ? last30[last30.length - 1].total - last30[0].total : 0;
  return { last30, monthDelta, currency: baseCurrency };
}
