import { prisma } from "./prisma";
import type { DashboardStats, VaultSummary } from "@/types";

// Получить начало и конец текущего месяца
function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

// Суммарный баланс по всем хранилищам (последний снимок или ручной расчёт)
export async function calcNetWorth(): Promise<number> {
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
      total += lastSnapshot.balance;
    } else {
      // Если снимка нет — берём сумму активов
      const assetsTotal = vault.assets.reduce(
        (sum, a) => sum + (a.currentTotalValue ?? 0),
        0
      );
      total += assetsTotal;
    }
  }

  return total;
}

// Сумма ликвидных активов (bank + cash с high/medium ликвидностью)
export async function calcLiquidCash(): Promise<number> {
  const vaults = await prisma.vault.findMany({
    where: {
      isActive: true,
      includeInNetWorth: true,
      type: { in: ["bank", "cash"] },
      liquidityLevel: { in: ["high", "medium"] },
    },
    include: {
      snapshots: { orderBy: { date: "desc" }, take: 1 },
      assets: { where: { isActive: true } },
    },
  });

  let total = 0;
  for (const vault of vaults) {
    const lastSnapshot = vault.snapshots[0];
    total += lastSnapshot
      ? lastSnapshot.balance
      : vault.assets.reduce((s, a) => s + (a.currentTotalValue ?? 0), 0);
  }
  return total;
}

// Доходы за текущий месяц
export async function calcMonthlyIncome(): Promise<number> {
  const { start, end } = currentMonthRange();
  const result = await prisma.transaction.aggregate({
    where: {
      type: "income",
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

// Расходы за текущий месяц
export async function calcMonthlyExpenses(): Promise<number> {
  const { start, end } = currentMonthRange();
  const result = await prisma.transaction.aggregate({
    where: {
      type: "expense",
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

// Общий объём инвестиций
export async function calcTotalInvestments(): Promise<number> {
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
    total += lastSnapshot
      ? lastSnapshot.balance
      : vault.assets.reduce((s, a) => s + (a.currentTotalValue ?? 0), 0);
  }
  return total;
}

// Общий долг — транзакции с типом expense которые помечены как долг (упрощённо)
export async function calcTotalDebts(): Promise<number> {
  // В v1 долги = хранилища с type "other" и отрицательным балансом (заглушка)
  return 0;
}

// Полная статистика дашборда
export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    totalNetWorth,
    liquidCash,
    monthlyIncome,
    monthlyExpenses,
    totalInvestments,
    totalDebts,
  ] = await Promise.all([
    calcNetWorth(),
    calcLiquidCash(),
    calcMonthlyIncome(),
    calcMonthlyExpenses(),
    calcTotalInvestments(),
    calcTotalDebts(),
  ]);

  const monthlySavings = monthlyIncome - monthlyExpenses;

  // Изменение капитала за последние 30 дней (упрощённо — из снимков)
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

  const oldNetWorth = oldSnapshots.reduce((s, snap) => s + snap.balance, 0);
  const netWorthChange = totalNetWorth - oldNetWorth;
  const netWorthChangePercent =
    oldNetWorth > 0 ? (netWorthChange / oldNetWorth) * 100 : 0;

  return {
    totalNetWorth,
    liquidCash,
    monthlyIncome,
    monthlyExpenses,
    monthlySavings,
    totalInvestments,
    totalDebts,
    netWorthChange,
    netWorthChangePercent,
    currency: "RUB",
  };
}

// Список хранилищ с балансами
export async function getVaultSummaries(): Promise<VaultSummary[]> {
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
    const balance = lastSnapshot
      ? lastSnapshot.balance
      : v.assets.reduce((s, a) => s + (a.currentTotalValue ?? 0), 0);

    return {
      id: v.id,
      name: v.name,
      type: v.type as import("@/types").VaultType,
      currency: v.currency,
      balance,
      liquidityLevel: v.liquidityLevel as import("@/types").LiquidityLevel,
      riskLevel: v.riskLevel as import("@/types").RiskLevel,
      color: v.color,
      icon: v.icon,
      assetsCount: v.assets.length,
    };
  });
}

// Транзакции за последние N дней для графика
export async function getRecentTransactions(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return prisma.transaction.findMany({
    where: { date: { gte: since } },
    include: { category: true, fromVault: true, toVault: true },
    orderBy: { date: "desc" },
  });
}
