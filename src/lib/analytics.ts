import { prisma } from "./prisma";
import {
  getExchangeRates,
  getBaseCurrency,
  convertAmount,
  type ExchangeRateMap,
} from "./currency";
import type { DashboardStats, VaultSummary } from "@/types";

// ─── Вспомогательные функции ──────────────────────────────────────────────────

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

/**
 * Конвертирует баланс снимка (или активов) в базовую валюту.
 * sourceCurrency — валюта, в которой хранится значение value.
 */
function toBase(
  value: number,
  sourceCurrency: string,
  baseCurrency: string,
  rates: ExchangeRateMap
): number {
  return convertAmount(value, sourceCurrency, baseCurrency, rates);
}

// ─── Агрегированные расчёты ───────────────────────────────────────────────────

export async function calcNetWorth(): Promise<number> {
  const [baseCurrency, rates] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
  ]);

  const vaults = await prisma.vault.findMany({
    where: { isActive: true, includeInNetWorth: true },
    include: {
      assets: { where: { isActive: true } },
      snapshots: { orderBy: { date: "desc" }, take: 1 },
    },
  });

  let total = 0;
  for (const vault of vaults) {
    const lastSnapshot = vault.snapshots[0];
    if (lastSnapshot) {
      total += toBase(lastSnapshot.balance, lastSnapshot.currency, baseCurrency, rates);
    } else {
      for (const asset of vault.assets) {
        total += toBase(asset.currentTotalValue ?? 0, asset.currency, baseCurrency, rates);
      }
    }
  }

  return total;
}

export async function calcSpendableBalance(): Promise<number> {
  const [baseCurrency, rates] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
  ]);

  const vaults = await prisma.vault.findMany({
    where: { isActive: true, includeInSpendableBalance: true },
    include: {
      snapshots: { orderBy: { date: "desc" }, take: 1 },
      assets: { where: { isActive: true } },
    },
  });

  let total = 0;
  for (const vault of vaults) {
    const lastSnapshot = vault.snapshots[0];
    if (lastSnapshot) {
      total += toBase(lastSnapshot.balance, lastSnapshot.currency, baseCurrency, rates);
    } else {
      for (const asset of vault.assets) {
        total += toBase(asset.currentTotalValue ?? 0, asset.currency, baseCurrency, rates);
      }
    }
  }
  return total;
}

export async function calcLiquidCapital(): Promise<number> {
  const [baseCurrency, rates] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
  ]);

  const vaults = await prisma.vault.findMany({
    where: { isActive: true, includeInLiquidCapital: true },
    include: {
      snapshots: { orderBy: { date: "desc" }, take: 1 },
      assets: { where: { isActive: true } },
    },
  });

  let total = 0;
  for (const vault of vaults) {
    const lastSnapshot = vault.snapshots[0];
    if (lastSnapshot) {
      total += toBase(lastSnapshot.balance, lastSnapshot.currency, baseCurrency, rates);
    } else {
      for (const asset of vault.assets) {
        total += toBase(asset.currentTotalValue ?? 0, asset.currency, baseCurrency, rates);
      }
    }
  }
  return total;
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
  const [baseCurrency, rates] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
  ]);

  const vaults = await prisma.vault.findMany({
    where: {
      isActive: true,
      includeInNetWorth: true,
      type: { in: ["investment", "crypto", "deposit"] },
    },
    include: {
      snapshots: { orderBy: { date: "desc" }, take: 1 },
      assets: { where: { isActive: true } },
    },
  });

  let total = 0;
  for (const vault of vaults) {
    const lastSnapshot = vault.snapshots[0];
    if (lastSnapshot) {
      total += toBase(lastSnapshot.balance, lastSnapshot.currency, baseCurrency, rates);
    } else {
      for (const asset of vault.assets) {
        total += toBase(asset.currentTotalValue ?? 0, asset.currency, baseCurrency, rates);
      }
    }
  }
  return total;
}

export async function calcTotalDebts(): Promise<number> {
  return 0;
}

// ─── Полная статистика дашборда ───────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const [baseCurrency, rates] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
  ]);

  // Все расчёты делаются с одним набором rates и baseCurrency
  const vaultsForNetWorth = await prisma.vault.findMany({
    where: { isActive: true, includeInNetWorth: true },
    include: {
      assets: { where: { isActive: true } },
      snapshots: { orderBy: { date: "desc" }, take: 1 },
    },
  });

  let totalNetWorth = 0;
  let totalInvestments = 0;

  for (const vault of vaultsForNetWorth) {
    const lastSnapshot = vault.snapshots[0];
    let vaultValueInBase = 0;

    if (lastSnapshot) {
      vaultValueInBase = toBase(lastSnapshot.balance, lastSnapshot.currency, baseCurrency, rates);
    } else {
      for (const asset of vault.assets) {
        vaultValueInBase += toBase(asset.currentTotalValue ?? 0, asset.currency, baseCurrency, rates);
      }
    }

    totalNetWorth += vaultValueInBase;

    if (["investment", "crypto", "deposit"].includes(vault.type)) {
      totalInvestments += vaultValueInBase;
    }
  }

  // Доступный баланс — по флагу includeInSpendableBalance
  const spendableVaults = await prisma.vault.findMany({
    where: { isActive: true, includeInSpendableBalance: true },
    include: {
      snapshots: { orderBy: { date: "desc" }, take: 1 },
      assets: { where: { isActive: true } },
    },
  });
  let spendableBalance = 0;
  for (const vault of spendableVaults) {
    const lastSnapshot = vault.snapshots[0];
    if (lastSnapshot) {
      spendableBalance += toBase(lastSnapshot.balance, lastSnapshot.currency, baseCurrency, rates);
    } else {
      for (const asset of vault.assets) {
        spendableBalance += toBase(asset.currentTotalValue ?? 0, asset.currency, baseCurrency, rates);
      }
    }
  }

  // Ликвидный капитал — по флагу includeInLiquidCapital
  const liquidVaults = await prisma.vault.findMany({
    where: { isActive: true, includeInLiquidCapital: true },
    include: {
      snapshots: { orderBy: { date: "desc" }, take: 1 },
      assets: { where: { isActive: true } },
    },
  });
  let liquidCapital = 0;
  for (const vault of liquidVaults) {
    const lastSnapshot = vault.snapshots[0];
    if (lastSnapshot) {
      liquidCapital += toBase(lastSnapshot.balance, lastSnapshot.currency, baseCurrency, rates);
    } else {
      for (const asset of vault.assets) {
        liquidCapital += toBase(asset.currentTotalValue ?? 0, asset.currency, baseCurrency, rates);
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

  // Изменение капитала за 30 дней
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldSnapshots = await prisma.vaultSnapshot.findMany({
    where: {
      date: { lte: thirtyDaysAgo },
      vault: { isActive: true, includeInNetWorth: true },
    },
    orderBy: { date: "desc" },
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
  };
}

// ─── Сводка по хранилищам ─────────────────────────────────────────────────────

export async function getVaultSummaries(): Promise<VaultSummary[]> {
  const [baseCurrency, rates] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
  ]);

  const vaults = await prisma.vault.findMany({
    where: { isActive: true },
    include: {
      snapshots: { orderBy: { date: "desc" }, take: 1 },
      assets: { where: { isActive: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return vaults.map((v) => {
    const lastSnapshot = v.snapshots[0];

    // balanceCurrency — валюта, в которой реально хранится значение balance
    const balanceCurrency = lastSnapshot?.currency ?? v.currency;

    const balance = lastSnapshot
      ? lastSnapshot.balance
      : v.assets.reduce((s, a) => s + (a.currentTotalValue ?? 0), 0);

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
