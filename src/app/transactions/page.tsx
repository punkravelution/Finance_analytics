import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { TRANSACTION_TYPE_LABELS } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, Plus } from "lucide-react";

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

const typeVariant: Record<string, "success" | "danger" | "info"> = {
  income: "success",
  expense: "danger",
  transfer: "info",
};

const typeLabels = TRANSACTION_TYPE_LABELS;

export default async function TransactionsPage() {
  const [transactions, stats] = await Promise.all([getTransactions(), getStats()]);

  const savings = stats.monthlyIncome - stats.monthlyExpenses;
  const savingsRate =
    stats.monthlyIncome > 0
      ? ((savings / stats.monthlyIncome) * 100).toFixed(0)
      : "0";

  // Группировка по дате
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
      {/* Header */}
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

      {/* Итоги месяца */}
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

      {/* Список транзакций */}
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
              {/* Заголовок дня */}
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
                      <Link
                        key={tx.id}
                        href={`/transactions/${tx.id}/edit`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-[hsl(216,34%,10%)] transition-colors"
                      >
                        {/* Иконка */}
                        <div className="w-8 h-8 rounded-lg bg-[hsl(216,34%,15%)] flex items-center justify-center text-sm flex-shrink-0">
                          {tx.category?.icon ??
                            (tx.type === "income"
                              ? "💰"
                              : tx.type === "expense"
                              ? "💸"
                              : "🔄")}
                        </div>

                        {/* Описание */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate">
                            {tx.note ?? tx.category?.name ?? typeLabels[tx.type as keyof typeof typeLabels]}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {tx.category && (
                              <span
                                className="text-[11px] px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: tx.category.color
                                    ? `${tx.category.color}20`
                                    : "#1e293b",
                                  color: tx.category.color ?? "#94a3b8",
                                }}
                              >
                                {tx.category.name}
                              </span>
                            )}
                            {tx.fromVault && (
                              <span className="text-[11px] text-slate-600">
                                {tx.fromVault.name}
                                {tx.toVault ? ` → ${tx.toVault.name}` : ""}
                              </span>
                            )}
                            {!tx.fromVault && tx.toVault && (
                              <span className="text-[11px] text-slate-600">
                                → {tx.toVault.name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Сумма */}
                        <div className="text-right flex-shrink-0">
                          <p
                            className={`text-sm font-semibold tabular-nums ${
                              tx.type === "income"
                                ? "text-green-400"
                                : tx.type === "expense"
                                ? "text-red-400"
                                : "text-slate-300"
                            }`}
                          >
                            {tx.type === "income"
                              ? "+"
                              : tx.type === "expense"
                              ? "−"
                              : ""}
                            {formatCurrency(tx.amount, tx.currency)}
                          </p>
                          <Badge variant={typeVariant[tx.type]} className="mt-0.5">
                            {typeLabels[tx.type as keyof typeof typeLabels]}
                          </Badge>
                        </div>
                      </Link>
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
