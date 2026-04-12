import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeftRight, Plus } from "lucide-react";
import { TransactionListRow, type TransactionListRowDto } from "@/components/transactions/TransactionListRow";
import type { CategoryOptionDto } from "@/components/transactions/TransactionCategoryQuickPick";

export const dynamic = "force-dynamic";

async function getTransactions() {
  return prisma.transaction.findMany({
    include: {
      category: true,
      fromVault: true,
      toVault: true,
    },
    orderBy: { date: "desc" },
    take: 100,
  });
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
  };
}

export default async function TransactionsPage() {
  const [transactions, stats, categories] = await Promise.all([
    getTransactions(),
    getStats(),
    getCategories(),
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
