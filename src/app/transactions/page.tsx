import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeftRight, Plus } from "lucide-react";
import { TransactionListRow, type TransactionListRowDto } from "@/components/transactions/TransactionListRow";
import type { CategoryOptionDto } from "@/components/transactions/TransactionCategoryQuickPick";
import type {
  RecurringOptionDto,
  SubscriptionOptionDto,
} from "@/components/transactions/RecurringLinkButton";
import type { PlannedExpenseOptionDto } from "@/components/transactions/PlannedExpenseLinkButton";
import type { LiabilityOptionDto } from "@/components/transactions/LiabilityLinkButton";

export const dynamic = "force-dynamic";

async function getTransactions() {
  return prisma.transaction.findMany({
    include: {
      category: true,
      fromVault: true,
      toVault: true,
      // Полные include (без вложенного select) — меньше шансов расхождения с DMMF при устаревшем client
      recurringIncome: true,
      subscription: true,
      plannedExpense: true,
      liability: true,
    },
    orderBy: { date: "desc" },
    take: 100,
  });
}

type RecurringRow = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingPeriod: string;
  nextIncomeDate: Date;
  vaultId: string;
};

type SubscriptionRow = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingPeriod: string;
  nextChargeDate: Date;
  vaultId: string;
};

type PlannedRow = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: Date | null;
  vaultId: string | null;
};

type LiabilityLinkRow = {
  id: string;
  name: string;
  currentBalance: number;
  currency: string;
  minimumPayment: number | null;
  nextPaymentDate: Date | null;
};

async function getActiveRecurringForLinking(): Promise<RecurringRow[]> {
  return prisma.recurringIncome.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      amount: true,
      currency: true,
      billingPeriod: true,
      nextIncomeDate: true,
      vaultId: true,
    },
  });
}

async function getActiveSubscriptionsForLinking(): Promise<SubscriptionRow[]> {
  return prisma.subscription.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      amount: true,
      currency: true,
      billingPeriod: true,
      nextChargeDate: true,
      vaultId: true,
    },
  });
}

async function getUnpaidPlannedForLinking(): Promise<PlannedRow[]> {
  return prisma.plannedExpense.findMany({
    where: { isPaid: false },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      name: true,
      amount: true,
      currency: true,
      dueDate: true,
      vaultId: true,
    },
  });
}

async function getLiabilitiesForDebtLinking(): Promise<LiabilityLinkRow[]> {
  return prisma.liability.findMany({
    where: { isActive: true, currentBalance: { gt: 0 } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      currentBalance: true,
      currency: true,
      minimumPayment: true,
      nextPaymentDate: true,
    },
  });
}

function recurringOptionsForVault(
  all: RecurringRow[],
  vaultId: string | null
): RecurringOptionDto[] {
  if (!vaultId) return [];
  return all
    .filter((r) => r.vaultId === vaultId)
    .map((r) => ({
      id: r.id,
      name: r.name,
      amount: r.amount,
      currency: r.currency,
      billingPeriod: r.billingPeriod,
      nextIncomeDate: r.nextIncomeDate,
    }));
}

function subscriptionOptionsForVault(
  all: SubscriptionRow[],
  vaultId: string | null
): SubscriptionOptionDto[] {
  if (!vaultId) return [];
  return all
    .filter((s) => s.vaultId === vaultId)
    .map((s) => ({
      id: s.id,
      name: s.name,
      amount: s.amount,
      currency: s.currency,
      billingPeriod: s.billingPeriod,
      nextChargeDate: s.nextChargeDate,
    }));
}

function plannedOptionsForVault(
  all: PlannedRow[],
  fromVaultId: string | null
): PlannedExpenseOptionDto[] {
  if (!fromVaultId) return [];
  return all
    .filter((p) => p.vaultId == null || p.vaultId === fromVaultId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      amount: p.amount,
      currency: p.currency,
      dueDate: p.dueDate,
    }));
}

function liabilityOptionsForCurrency(
  all: LiabilityLinkRow[],
  txCurrency: string
): LiabilityOptionDto[] {
  const cur = txCurrency.trim().toUpperCase() || "RUB";
  return all
    .filter((l) => l.currency.trim().toUpperCase() === cur)
    .map((l) => ({
      id: l.id,
      name: l.name,
      currentBalance: l.currentBalance,
      currency: l.currency,
      minimumPayment: l.minimumPayment,
      nextPaymentDate: l.nextPaymentDate,
    }));
}

async function getCategories(): Promise<CategoryOptionDto[]> {
  return prisma.category.findMany({
    select: { id: true, name: true, type: true, color: true },
    orderBy: { name: "asc" },
  });
}

async function getStats() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [income, expenses] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: "income", date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "expense", date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
  ]);

  return {
    monthlyIncome: income._sum.amount ?? 0,
    monthlyExpenses: expenses._sum.amount ?? 0,
  };
}

function toRowDto(tx: Awaited<ReturnType<typeof getTransactions>>[number]): TransactionListRowDto {
  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency,
    note: tx.note,
    tags: tx.tags,
    categoryId: tx.categoryId,
    category: tx.category
      ? {
          id: tx.category.id,
          name: tx.category.name,
          color: tx.category.color,
          icon: tx.category.icon,
        }
      : null,
    fromVault: tx.fromVault ? { id: tx.fromVault.id, name: tx.fromVault.name } : null,
    toVault: tx.toVault ? { id: tx.toVault.id, name: tx.toVault.name } : null,
    recurringIncome: tx.recurringIncome,
    subscription: tx.subscription,
    plannedExpense: tx.plannedExpense,
    liability: tx.liability,
  };
}

export default async function TransactionsPage() {
  const [transactions, stats, categories, recurringAll, subsAll, plannedAll, liabilityAll] =
    await Promise.all([
      getTransactions(),
      getStats(),
      getCategories(),
      getActiveRecurringForLinking(),
      getActiveSubscriptionsForLinking(),
      getUnpaidPlannedForLinking(),
      getLiabilitiesForDebtLinking(),
    ]);

  const savings = stats.monthlyIncome - stats.monthlyExpenses;
  const savingsRate =
    stats.monthlyIncome > 0
      ? ((savings / stats.monthlyIncome) * 100).toFixed(0)
      : "0";

  const grouped = transactions.reduce<
    Record<string, typeof transactions>
  >((acc, tx) => {
    const key = tx.date.toISOString().split("T")[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});

  const now = new Date();
  const monthName = now.toLocaleString("ru-RU", { month: "long", year: "numeric" });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowLeftRight size={22} className="text-cyan-400" />
            Операции
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {transactions.length} записей · последние 100
          </p>
          <Link
            href="/settings/categories-tags"
            className="text-xs text-blue-400/90 hover:text-blue-300 mt-2 inline-block"
          >
            Категории и теги
          </Link>
        </div>
        <Link
          href="/transactions/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          Добавить
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-7">
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Доходы · {monthName}</p>
          <p className="text-xl font-bold text-green-400 tabular-nums">
            +{formatCurrency(stats.monthlyIncome)}
          </p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Расходы · {monthName}</p>
          <p className="text-xl font-bold text-red-400 tabular-nums">
            −{formatCurrency(stats.monthlyExpenses)}
          </p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Накопления</p>
          <p
            className={`text-xl font-bold tabular-nums ${
              savings >= 0 ? "text-cyan-400" : "text-red-400"
            }`}
          >
            {savings >= 0 ? "+" : ""}
            {formatCurrency(savings)}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {savingsRate}% от дохода
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {Object.entries(grouped).map(([dateStr, txs]) => {
          const dayIncome = txs
            .filter((t) => t.type === "income")
            .reduce((s, t) => s + t.amount, 0);
          const dayExpense = txs
            .filter((t) => t.type === "expense")
            .reduce((s, t) => s + t.amount, 0);

          return (
            <div key={dateStr}>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-medium text-slate-500">
                  {new Date(dateStr).toLocaleDateString("ru-RU", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <div className="flex items-center gap-3">
                  {dayIncome > 0 && (
                    <span className="text-xs text-green-500">
                      +{formatCurrency(dayIncome)}
                    </span>
                  )}
                  {dayExpense > 0 && (
                    <span className="text-xs text-red-500">
                      −{formatCurrency(dayExpense)}
                    </span>
                  )}
                </div>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-[hsl(216,34%,13%)]">
                    {txs.map((tx) => (
                      <TransactionListRow
                        key={tx.id}
                        tx={toRowDto(tx)}
                        categories={categories}
                        recurringOptions={recurringOptionsForVault(recurringAll, tx.toVaultId)}
                        subscriptionOptions={subscriptionOptionsForVault(subsAll, tx.fromVaultId)}
                        plannedOptions={plannedOptionsForVault(plannedAll, tx.fromVaultId)}
                        liabilityOptions={liabilityOptionsForCurrency(liabilityAll, tx.currency)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}

        {transactions.length === 0 && (
          <div className="text-center py-16 text-slate-600">
            <ArrowLeftRight size={40} className="mx-auto mb-3 opacity-30" />
            <p>Операций нет</p>
          </div>
        )}
      </div>
    </div>
  );
}
