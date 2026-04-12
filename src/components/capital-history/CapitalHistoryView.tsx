"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getCapitalGrowth, getCapitalHistory, takeCapitalSnapshot } from "@/app/actions/snapshot";
import type {
  CapitalGrowthMetrics,
  CapitalHistoryDay,
  HistoryPeriodMonths,
  MonthlyCapitalRow,
} from "@/types/capitalHistory";

const PERIODS: { value: HistoryPeriodMonths; label: string }[] = [
  { value: 3, label: "3 мес" },
  { value: 6, label: "6 мес" },
  { value: 12, label: "1 год" },
  { value: "all", label: "Всё время" },
];

const VAULT_PALETTE = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f97316",
  "#06b6d4",
  "#eab308",
  "#ec4899",
  "#64748b",
];

function toMonthlyHistory(daily: CapitalHistoryDay[]): CapitalHistoryDay[] {
  const m = new Map<string, CapitalHistoryDay>();
  for (const row of daily) {
    const mk = row.date.slice(0, 7);
    m.set(mk, {
      date: `${mk}-01`,
      total: row.total,
      byVault: row.byVault.map((x) => ({ ...x })),
    });
  }
  return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function formatChartX(isoDay: string, monthly: boolean): string {
  const d = new Date(`${isoDay}T12:00:00`);
  if (monthly) {
    return new Intl.DateTimeFormat("ru-RU", { month: "short", year: "numeric" }).format(d);
  }
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(d);
}

function compactCurrencyFormatter(currency: string) {
  const fmt = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return (v: number) => fmt.format(v);
}

type TotalRow = { xLabel: string; sortKey: string; total: number };
type StackedRow = Record<string, string | number>;

interface CapitalHistoryViewProps {
  initialHistory: CapitalHistoryDay[];
  initialGrowth: CapitalGrowthMetrics;
  initialPeriod: HistoryPeriodMonths;
  monthlyTable: MonthlyCapitalRow[];
  baseCurrency: string;
}

export function CapitalHistoryView({
  initialHistory,
  initialGrowth,
  initialPeriod,
  monthlyTable,
  baseCurrency,
}: CapitalHistoryViewProps) {
  const router = useRouter();
  const [period, setPeriod] = useState<HistoryPeriodMonths>(initialPeriod);
  const [history, setHistory] = useState<CapitalHistoryDay[]>(initialHistory);
  const [growth, setGrowth] = useState<CapitalGrowthMetrics>(initialGrowth);
  const [pending, startTransition] = useTransition();
  const [snapPending, setSnapPending] = useState(false);
  const [snapMessage, setSnapMessage] = useState<string | null>(null);

  const reloadForPeriod = useCallback((p: HistoryPeriodMonths) => {
    setPeriod(p);
    startTransition(async () => {
      const [h, g] = await Promise.all([getCapitalHistory(p), getCapitalGrowth(p)]);
      setHistory(h);
      setGrowth(g);
    });
  }, []);

  const chartHistory = useMemo(
    () => (history.length > 45 ? toMonthlyHistory(history) : history),
    [history]
  );
  const useMonthlyX = history.length > 45;

  const totalChartData: TotalRow[] = useMemo(
    () =>
      chartHistory.map((row) => ({
        xLabel: formatChartX(row.date, useMonthlyX),
        sortKey: row.date,
        total: row.total,
      })),
    [chartHistory, useMonthlyX]
  );

  const { stackedData, vaultSeries } = useMemo(() => {
    const ids = new Set<string>();
    for (const r of chartHistory) {
      for (const v of r.byVault) ids.add(v.vaultId);
    }
    const idList = [...ids];
    const nameById = new Map<string, string>();
    for (const r of chartHistory) {
      for (const v of r.byVault) {
        if (!nameById.has(v.vaultId)) nameById.set(v.vaultId, v.name);
      }
    }
    const stacked: StackedRow[] = chartHistory.map((row) => {
      const o: StackedRow = {
        xLabel: formatChartX(row.date, useMonthlyX),
        sortKey: row.date,
      };
      for (const id of idList) {
        o[`v_${id}`] = row.byVault.find((x) => x.vaultId === id)?.balance ?? 0;
      }
      return o;
    });
    const vaultSeries = idList.map((id, i) => ({
      id,
      dataKey: `v_${id}` as const,
      name: nameById.get(id) ?? id,
      color: VAULT_PALETTE[i % VAULT_PALETTE.length],
    }));
    return { stackedData: stacked, vaultSeries };
  }, [chartHistory, useMonthlyX]);

  const yTickFmt = useMemo(() => compactCurrencyFormatter(baseCurrency), [baseCurrency]);

  const onTakeSnapshot = async () => {
    setSnapMessage(null);
    setSnapPending(true);
    try {
      const r = await takeCapitalSnapshot();
      if (r.error) {
        setSnapMessage(r.error);
      } else {
        setSnapMessage(`Создано снимков: ${r.created}, пропущено (уже за сегодня): ${r.skipped}`);
        router.refresh();
        reloadForPeriod(period);
      }
    } finally {
      setSnapPending(false);
    }
  };

  const pctColor =
    growth.percentGrowth === null
      ? "text-slate-400"
      : growth.percentGrowth >= 0
        ? "text-green-400"
        : "text-red-400";

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">История капитала</h1>
          <p className="text-sm text-slate-500 mt-1">
            Автоматические снимки по хранилищам в {baseCurrency}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button
            type="button"
            onClick={() => void onTakeSnapshot()}
            disabled={snapPending}
            variant="secondary"
            className="shrink-0"
          >
            {snapPending ? "Сохранение…" : "Сделать снимок сейчас"}
          </Button>
          {snapMessage && <p className="text-xs text-slate-400 max-w-md text-right">{snapMessage}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Button
            key={String(p.value)}
            type="button"
            size="sm"
            variant={period === p.value ? "default" : "outline"}
            disabled={pending}
            onClick={() => reloadForPeriod(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Текущий капитал
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-white">
              {formatCurrency(growth.currentValue, growth.currency)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Рост за период
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums",
                growth.absoluteGrowth >= 0 ? "text-green-400" : "text-red-400"
              )}
            >
              {growth.absoluteGrowth >= 0 ? "+" : ""}
              {formatCurrency(growth.absoluteGrowth, growth.currency)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Рост %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-bold tabular-nums", pctColor)}>
              {growth.percentGrowth === null ? "—" : formatPercent(growth.percentGrowth)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Лучший месяц
            </CardTitle>
          </CardHeader>
          <CardContent>
            {growth.bestMonth ? (
              <>
                <p className="text-sm text-slate-300 capitalize">{growth.bestMonth.label}</p>
                <p className="text-lg font-semibold tabular-nums text-green-400 mt-1">
                  +{formatCurrency(growth.bestMonth.delta, growth.currency)}
                </p>
              </>
            ) : (
              <p className="text-slate-500 text-sm">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)]">
        <CardHeader>
          <CardTitle className="text-base text-white">Капитал по дням</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {history.length < 2 ? (
            <div className="h-full flex items-center justify-center text-center text-sm text-slate-500 px-4">
              Недостаточно данных. Снимки сохраняются автоматически каждый день при открытии приложения.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={totalChartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="capitalHistoryGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,34%,17%)" vertical={false} />
                <XAxis dataKey="xLabel" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                  tickFormatter={(v) => yTickFmt(Number(v))}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as TotalRow | undefined;
                    const val = row?.total ?? Number(payload[0]?.value);
                    return (
                      <div className="rounded-lg border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,10%)] px-3 py-2 shadow-lg">
                        <p className="text-xs text-slate-400 mb-1">{label}</p>
                        <p className="text-sm font-semibold text-white">
                          {formatCurrency(val, baseCurrency)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#capitalHistoryGreen)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)]">
        <CardHeader>
          <CardTitle className="text-base text-white">Разбивка по хранилищам</CardTitle>
        </CardHeader>
        <CardContent className="h-[360px]">
          {history.length < 2 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">
              Недостаточно данных для разбивки.
            </div>
          ) : vaultSeries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">
              Нет привязки к хранилищам.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stackedData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,34%,17%)" vertical={false} />
                <XAxis dataKey="xLabel" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                  tickFormatter={(v) => yTickFmt(Number(v))}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,10%)] px-3 py-2 shadow-lg max-h-64 overflow-y-auto">
                        <p className="text-xs text-slate-400 mb-2">{label}</p>
                        <ul className="space-y-1 text-xs">
                          {payload
                            .filter((p) => typeof p.dataKey === "string" && p.dataKey.startsWith("v_"))
                            .map((p) => (
                              <li key={String(p.dataKey)} className="flex justify-between gap-4">
                                <span className="text-slate-400">{p.name}</span>
                                <span className="font-medium text-white tabular-nums">
                                  {formatCurrency(Number(p.value), baseCurrency)}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                {vaultSeries.map((s) => (
                  <Area
                    key={s.id}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={s.name}
                    stackId="vault"
                    stroke={s.color}
                    fill={s.color}
                    fillOpacity={0.85}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)]">
        <CardHeader>
          <CardTitle className="text-base text-white">Месячные изменения (12 мес.)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(216,34%,17%)] text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">Месяц</th>
                <th className="py-2 pr-4 font-medium tabular-nums">Начало</th>
                <th className="py-2 pr-4 font-medium tabular-nums">Конец</th>
                <th className="py-2 pr-4 font-medium tabular-nums">Изменение</th>
                <th className="py-2 font-medium tabular-nums">%</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTable.map((row) => (
                <tr key={row.monthKey} className="border-b border-[hsl(216,34%,14%)] text-slate-200">
                  <td className="py-2 pr-4 capitalize">{row.label}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatCurrency(row.startBalance, baseCurrency)}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatCurrency(row.endBalance, baseCurrency)}</td>
                  <td
                    className={cn(
                      "py-2 pr-4 tabular-nums font-medium",
                      row.change >= 0 ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {row.change >= 0 ? "+" : ""}
                    {formatCurrency(row.change, baseCurrency)}
                  </td>
                  <td
                    className={cn(
                      "py-2 tabular-nums",
                      row.percentChange === null
                        ? "text-slate-500"
                        : row.percentChange >= 0
                          ? "text-green-400"
                          : "text-red-400"
                    )}
                  >
                    {row.percentChange === null ? "—" : formatPercent(row.percentChange)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-600 mt-3">
            Начало — остаток на конец предыдущего месяца; конец — на последний день месяца с данными.
          </p>
        </CardContent>
      </Card>

      <div>
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">
          ← На главную
        </Link>
      </div>
    </div>
  );
}
