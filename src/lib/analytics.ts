import { prisma } from "./prisma";
import {
  getExchangeRates,
  getBaseCurrency,
  convertAmount,
  type ExchangeRateMap,
} from "./currency";
import { getVaultBalance, getVaultBalanceInCurrency } from "./vaultBalance";
import type { DashboardStats, VaultSummary } from "@/types";
import { getCategoryBudgetMap } from "./categoryBudgets";

// ─── Вспомогательные функции ──────────────────────────────────────────────────
const STALE_ASSET_PRICE_DAYS = 7;

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function toBase(
  value: number,
  sourceCurrency: string,
  baseCurrency: string,
  rates: ExchangeRateMap
): number {
  return convertAmount(value, sourceCurrency, baseCurrency, rates);
}

// Запрос всех активных vault с активами — единый shape для всех расчётов
async function fetchActiveVaultsWithAssets() {
  return prisma.vault.findMany({
    where: { isActive: true },
    include: {
      assets: {
        where: { isActive: true },
        select: { currentTotalValue: true, currency: true, lastUpdatedAt: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

// ─── Агрегированные расчёты ───────────────────────────────────────────────────

export async function calcNetWorth(): Promise<number> {
  const [baseCurrency, rates, vaults] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
    prisma.vault.findMany({
      where: { isActive: true, includeInNetWorth: true },
      include: { assets: { where: { isActive: true }, select: { currentTotalValue: true, currency: true } } },
    }),
  ]);
  return vaults.reduce((sum, v) => {
    const { balance } = getVaultBalance(v, rates);
    return sum + toBase(balance, v.currency, baseCurrency, rates);
  }, 0);
}

export async function calcSpendableBalance(): Promise<number> {
  const [baseCurrency, rates, vaults] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
    prisma.vault.findMany({
      where: { isActive: true, includeInSpendableBalance: true },
      include: { assets: { where: { isActive: true }, select: { currentTotalValue: true, currency: true } } },
    }),
  ]);
  return vaults.reduce((sum, v) => {
    const { balance } = getVaultBalance(v, rates);
    return sum + toBase(balance, v.currency, baseCurrency, rates);
  }, 0);
}

export async function calcLiquidCapital(): Promise<number> {
  const [baseCurrency, rates, vaults] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
    prisma.vault.findMany({
      where: { isActive: true, includeInLiquidCapital: true },
      include: { assets: { where: { isActive: true }, select: { currentTotalValue: true, currency: true } } },
    }),
  ]);
  return vaults.reduce((sum, v) => {
    const { balance } = getVaultBalance(v, rates);
    return sum + toBase(balance, v.currency, baseCurrency, rates);
  }, 0);
}

export async function calcMonthlyIncome(): Promise<number> {
  const [baseCurrency, rates] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
  ]);
  const { start, end } = currentMonthRange();
  const transactions = await prisma.transaction.findMany({
    where: { type: "income", date: { gte: start, lte: end } },
    select: { amount: true, currency: true },
  });
  return transactions.reduce(
    (sum, tx) => sum + toBase(tx.amount, tx.currency, baseCurrency, rates),
    0
  );
}

export async function calcMonthlyExpenses(): Promise<number> {
  const [baseCurrency, rates] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
  ]);
  const { start, end } = currentMonthRange();
  const transactions = await prisma.transaction.findMany({
    where: { type: "expense", date: { gte: start, lte: end } },
    select: { amount: true, currency: true },
  });
  return transactions.reduce(
    (sum, tx) => sum + toBase(tx.amount, tx.currency, baseCurrency, rates),
    0
  );
}

export async function calcTotalInvestments(): Promise<number> {
  const [baseCurrency, rates, vaults] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
    prisma.vault.findMany({
      where: { isActive: true, includeInNetWorth: true, type: { in: ["investment", "crypto", "deposit"] } },
      include: { assets: { where: { isActive: true }, select: { currentTotalValue: true, currency: true } } },
    }),
  ]);
  return vaults.reduce((sum, v) => {
    const { balance } = getVaultBalance(v, rates);
    return sum + toBase(balance, v.currency, baseCurrency, rates);
  }, 0);
}

export async function calcTotalDebts(): Promise<number> {
  return 0;
}

// ─── Полная статистика дашборда ───────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const [baseCurrency, rates, allVaults] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
    fetchActiveVaultsWithAssets(),
  ]);

  let totalNetWorth = 0;
  let spendableBalance = 0;
  let liquidCapital = 0;
  let totalInvestments = 0;
  let staleAssetPricesCount = 0;
  let staleAssetPricesOldestUpdatedAt: Date | null = null;
  let assetsMissingValuationCount = 0;
  const staleThreshold = new Date(Date.now() - STALE_ASSET_PRICE_DAYS * 24 * 60 * 60 * 1000);

  for (const vault of allVaults) {
    const inBase = getVaultBalanceInCurrency(vault, baseCurrency, rates);

    if (vault.includeInNetWorth) totalNetWorth += inBase;
    if (vault.includeInSpendableBalance) spendableBalance += inBase;
    if (vault.includeInLiquidCapital) liquidCapital += inBase;
    if (["investment", "crypto", "deposit"].includes(vault.type)) {
      totalInvestments += inBase;
    }

    for (const asset of vault.assets) {
      if (asset.currentTotalValue == null) {
        assetsMissingValuationCount += 1;
        continue;
      }
      const updatedAt = asset.lastUpdatedAt;
      const isStale = !updatedAt || updatedAt < staleThreshold;
      if (!isStale) continue;
      staleAssetPricesCount += 1;
      if (!staleAssetPricesOldestUpdatedAt || !updatedAt || updatedAt < staleAssetPricesOldestUpdatedAt) {
        staleAssetPricesOldestUpdatedAt = updatedAt ?? new Date(0);
      }
    }
  }

  const { start, end } = currentMonthRange();

  const [incomeRows, expenseRows] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: "income", date: { gte: start, lte: end } },
      select: { amount: true, currency: true },
    }),
    prisma.transaction.findMany({
      where: { type: "expense", date: { gte: start, lte: end } },
      select: { amount: true, currency: true },
    }),
  ]);

  const monthlyIncome = incomeRows.reduce(
    (s, tx) => s + toBase(tx.amount, tx.currency, baseCurrency, rates),
    0
  );
  const monthlyExpenses = expenseRows.reduce(
    (s, tx) => s + toBase(tx.amount, tx.currency, baseCurrency, rates),
    0
  );
  const monthlySavings = monthlyIncome - monthlyExpenses;

  // Изменение капитала за 30 дней (из исторических снимков)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldSnapshots = await prisma.vaultSnapshot.findMany({
    where: {
      date: { gte: thirtyDaysAgo },
      vault: { isActive: true, includeInNetWorth: true },
    },
    orderBy: { date: "asc" },
    distinct: ["vaultId"],
  });

  const oldNetWorth = oldSnapshots.reduce(
    (s, snap) => s + toBase(snap.balance, snap.currency, baseCurrency, rates),
    0
  );

  const netWorthChange = totalNetWorth - oldNetWorth;
  const netWorthChangePercent =
    oldNetWorth > 0 ? (netWorthChange / oldNetWorth) * 100 : 0;

  return {
    totalNetWorth,
    spendableBalance,
    liquidCapital,
    monthlyIncome,
    monthlyExpenses,
    monthlySavings,
    totalInvestments,
    totalDebts: 0,
    netWorthChange,
    netWorthChangePercent,
    currency: baseCurrency,
    staleAssetPricesCount,
    staleAssetPricesOldestUpdatedAt:
      staleAssetPricesOldestUpdatedAt && staleAssetPricesOldestUpdatedAt.getTime() > 0
        ? staleAssetPricesOldestUpdatedAt.toISOString()
        : null,
    assetsMissingValuationCount,
  };
}

// ─── Сводка по хранилищам ─────────────────────────────────────────────────────

export async function getVaultSummaries(): Promise<VaultSummary[]> {
  const [baseCurrency, rates, vaults] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
    fetchActiveVaultsWithAssets(),
  ]);

  return vaults.map((v) => {
    const { balance, currency: balanceCurrency } = getVaultBalance(v, rates);
    const balanceInBaseCurrency = toBase(balance, balanceCurrency, baseCurrency, rates);

    return {
      id: v.id,
      name: v.name,
      type: v.type as import("@/types").VaultType,
      currency: v.currency,
      balance,
      balanceCurrency,
      balanceInBaseCurrency,
      liquidityLevel: v.liquidityLevel as import("@/types").LiquidityLevel,
      riskLevel: v.riskLevel as import("@/types").RiskLevel,
      color: v.color,
      icon: v.icon,
      assetsCount: v.assets.length,
    };
  });
}

// ─── Транзакции для графика ────────────────────────────────────────────────────

export async function getRecentTransactions(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return prisma.transaction.findMany({
    where: { date: { gte: since } },
    include: { category: true, fromVault: true, toVault: true },
    orderBy: { date: "desc" },
  });
}

export interface DashboardAnomaly {
  severity: "warning" | "critical";
  message: string;
}

export async function getDashboardAnomalies(): Promise<DashboardAnomaly[]> {
  const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getExchangeRates()]);
  const anomalies: DashboardAnomaly[] = [];
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const next7days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);

  // 1) Категория выросла >30% к прошлому месяцу
  {
    const [currExpense, prevExpense] = await Promise.all([
      prisma.transaction.findMany({
        where: { type: "expense", date: { gte: currentMonthStart, lte: now } },
        select: { amount: true, currency: true, category: { select: { name: true } } },
      }),
      prisma.transaction.findMany({
        where: { type: "expense", date: { gte: previousMonthStart, lt: previousMonthEnd } },
        select: { amount: true, currency: true, category: { select: { name: true } } },
      }),
    ]);
    const currMap = new Map<string, number>();
    const prevMap = new Map<string, number>();
    for (const tx of currExpense) {
      const name = tx.category?.name ?? "Без категории";
      const v = convertAmount(tx.amount, tx.currency, baseCurrency, rates);
      currMap.set(name, (currMap.get(name) ?? 0) + v);
    }
    for (const tx of prevExpense) {
      const name = tx.category?.name ?? "Без категории";
      const v = convertAmount(tx.amount, tx.currency, baseCurrency, rates);
      prevMap.set(name, (prevMap.get(name) ?? 0) + v);
    }
    const growth = [...currMap.entries()]
      .map(([name, curr]) => {
        const prev = prevMap.get(name) ?? 0;
        const pct = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
        return { name, curr, prev, pct };
      })
      .filter((x) => x.prev > 0 && x.pct > 30)
      .sort((a, b) => b.pct - a.pct)[0];
    if (growth) {
      anomalies.push({
        severity: "warning",
        message: `⚠️ Категория '${growth.name}' выросла на ${growth.pct.toFixed(1)}% к прошлому месяцу`,
      });
    }
  }

  // 2) Нет поступления дохода, когда ожидался по recurring
  {
    const recurring = await prisma.recurringIncome.findMany({
      where: { isActive: true, nextIncomeDate: { lte: now } },
      select: { id: true, name: true },
    });
    if (recurring.length > 0) {
      const received = await prisma.transaction.findMany({
        where: {
          type: "income",
          recurringIncomeId: { in: recurring.map((r) => r.id) },
          date: { gte: currentMonthStart, lte: now },
        },
        select: { recurringIncomeId: true },
      });
      const receivedSet = new Set(
        received.map((r) => r.recurringIncomeId).filter((id): id is string => id != null)
      );
      const missed = recurring.filter((r) => !receivedSet.has(r.id));
      if (missed.length > 0) {
        anomalies.push({
          severity: "warning",
          message: `⚠️ Не зафиксирован ожидаемый доход: ${missed.slice(0, 2).map((m) => m.name).join(", ")}${missed.length > 2 ? "..." : ""}`,
        });
      }
    }
  }

  // 3) Платеж через <7 дней и нет транзакции
  {
    const plannedSoon = await prisma.plannedExpense.findMany({
      where: { isPaid: false, dueDate: { gte: now, lte: next7days } },
      select: { id: true, name: true },
    });
    if (plannedSoon.length > 0) {
      const linked = await prisma.transaction.findMany({
        where: {
          plannedExpenseId: { in: plannedSoon.map((p) => p.id) },
          type: "expense",
          date: { gte: currentMonthStart, lte: now },
        },
        select: { plannedExpenseId: true },
      });
      const linkedSet = new Set(
        linked.map((l) => l.plannedExpenseId).filter((id): id is string => id != null)
      );
      const missed = plannedSoon.filter((p) => !linkedSet.has(p.id));
      if (missed.length > 0) {
        anomalies.push({
          severity: "warning",
          message: `⚠️ Запланированный платёж < 7 дней без транзакции: ${missed
            .slice(0, 2)
            .map((m) => m.name)
            .join(", ")}${missed.length > 2 ? "..." : ""}`,
        });
      }
    }
  }

  // 4) Баланс кошелька ниже порога
  {
    const thresholdSetting = await prisma.appSettings.findUnique({
      where: { key: "alerts.lowBalanceThreshold" },
      select: { value: true },
    });
    const threshold = thresholdSetting ? Number.parseFloat(thresholdSetting.value) : NaN;
    if (Number.isFinite(threshold) && threshold > 0) {
      const vaults = await getVaultSummaries();
      const low = vaults.filter((v) => v.balanceInBaseCurrency < threshold);
      if (low.length > 0) {
        anomalies.push({
          severity: "critical",
          message: `🚨 Баланс ниже порога у ${low.length} хранилищ(а), порог ${threshold.toFixed(0)} ${baseCurrency}`,
        });
      }
    }
  }

  return anomalies;
}

export interface MonthlySummary {
  monthLabel: string;
  capitalDelta: number;
  overspend: Array<{ category: string; overspend: number }>;
  savingsRatePct: number;
  targetSavingsPct: number;
  savingsGoalMet: boolean;
  nextMonthActions: string[];
}

export async function getPreviousMonthSummary(): Promise<MonthlySummary> {
  const [baseCurrency, rates, budgetMap] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
    getCategoryBudgetMap(),
  ]);
  const now = new Date();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const beforePrevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);

  const [
    txRows,
    targetSavingsSetting,
    endSnapshots,
    startSnapshots,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        date: { gte: prevMonthStart, lte: prevMonthEnd },
        type: { in: ["income", "expense"] },
      },
      select: {
        type: true,
        amount: true,
        currency: true,
        categoryId: true,
        category: { select: { name: true } },
      },
    }),
    prisma.appSettings.findUnique({
      where: { key: "financialPlan.targetSavingsPct" },
      select: { value: true },
    }),
    prisma.vaultSnapshot.findMany({
      where: {
        date: { lte: prevMonthEnd },
        vault: { isActive: true, includeInNetWorth: true },
      },
      orderBy: { date: "desc" },
      distinct: ["vaultId"],
      select: { vaultId: true, balance: true, currency: true },
    }),
    prisma.vaultSnapshot.findMany({
      where: {
        date: { lte: beforePrevStart },
        vault: { isActive: true, includeInNetWorth: true },
      },
      orderBy: { date: "desc" },
      distinct: ["vaultId"],
      select: { vaultId: true, balance: true, currency: true },
    }),
  ]);

  let income = 0;
  let expense = 0;
  const spentByCategory = new Map<string, { name: string; value: number }>();
  for (const tx of txRows) {
    const value = convertAmount(tx.amount, tx.currency, baseCurrency, rates);
    if (tx.type === "income") {
      income += value;
    } else {
      expense += value;
      if (tx.categoryId) {
        const prev = spentByCategory.get(tx.categoryId) ?? {
          name: tx.category?.name ?? "Без категории",
          value: 0,
        };
        prev.value += value;
        spentByCategory.set(tx.categoryId, prev);
      }
    }
  }

  const endTotal = endSnapshots.reduce(
    (sum, s) => sum + convertAmount(s.balance, s.currency, baseCurrency, rates),
    0
  );
  const startTotal = startSnapshots.reduce(
    (sum, s) => sum + convertAmount(s.balance, s.currency, baseCurrency, rates),
    0
  );
  const capitalDelta = endTotal - startTotal;

  const overspend = Object.entries(budgetMap)
    .map(([categoryId, limit]) => {
      const spent = spentByCategory.get(categoryId);
      if (!spent) return null;
      const diff = spent.value - limit;
      return diff > 0 ? { category: spent.name, overspend: diff } : null;
    })
    .filter((x): x is { category: string; overspend: number } => x !== null)
    .sort((a, b) => b.overspend - a.overspend)
    .slice(0, 3);

  const targetSavingsPct = targetSavingsSetting?.value
    ? Number.parseFloat(targetSavingsSetting.value)
    : 20;
  const savingsRatePct = income > 0 ? ((income - expense) / income) * 100 : 0;
  const savingsGoalMet = savingsRatePct >= targetSavingsPct;

  const nextMonthActions: string[] = [];
  if (!savingsGoalMet) {
    nextMonthActions.push(
      `Довести норму сбережений до ${targetSavingsPct.toFixed(0)}% (сейчас ${savingsRatePct.toFixed(1)}%)`
    );
  }
  if (overspend.length > 0) {
    nextMonthActions.push(
      `Сократить перерасход в категориях: ${overspend.map((o) => o.category).join(", ")}`
    );
  }
  if (capitalDelta < 0) {
    nextMonthActions.push("Стабилизировать капитал: ограничить необязательные траты и усилить контроль бюджета");
  } else if (nextMonthActions.length === 0) {
    nextMonthActions.push("Сохранить текущую дисциплину и направить дополнительный остаток в цели/долги");
  }

  const monthLabel = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  })
    .format(prevMonthStart)
    .replace(" г.", "");

  return {
    monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
    capitalDelta,
    overspend,
    savingsRatePct,
    targetSavingsPct,
    savingsGoalMet,
    nextMonthActions,
  };
}
