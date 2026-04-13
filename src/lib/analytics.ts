import { prisma } from "./prisma";
import {
  getExchangeRates,
  getBaseCurrency,
  convertAmount,
  type ExchangeRateMap,
} from "./currency";
import { getVaultBalance, getVaultBalanceInCurrency } from "./vaultBalance";
import type { DashboardStats, VaultSummary } from "@/types";

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
