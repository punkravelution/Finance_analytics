import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart2 } from "lucide-react";
import { MonthlyChart } from "@/components/analytics/MonthlyChart";
import { CategoryBreakdown } from "@/components/analytics/CategoryBreakdown";
import { getExchangeRates, getBaseCurrency, convertAmount } from "@/lib/currency";

export const dynamic = "force-dynamic";

async function getMonthlyData() {
  const [baseCurrency, rates] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
  ]);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: sixMonthsAgo },
      type: { in: ["income", "expense"] },
    },
    select: { date: true, type: true, amount: true, currency: true },
    orderBy: { date: "asc" },
  });

  const grouped = new Map<string, { income: number; expense: number }>();

  for (const tx of transactions) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    const existing = grouped.get(key) ?? { income: 0, expense: 0 };
    const amountInBase = convertAmount(tx.amount, tx.currency, baseCurrency, rates);
    if (tx.type === "income") existing.income += amountInBase;
    else existing.expense += amountInBase;
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries()).map(([key, data]) => {
    const [year, month] = key.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return {
      month: date.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }),
      income: data.income,
      expense: data.expense,
      savings: data.income - data.expense,
    };
  });
}

async function getCategoryExpenses() {
  const [baseCurrency, rates] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
  ]);

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);

  // groupBy не позволяет получить currency, поэтому берём строки явно
  const transactions = await prisma.transaction.findMany({
    where: {
      type: "expense",
      date: { gte: start },
      categoryId: { not: null },
    },
    select: { categoryId: true, amount: true, currency: true },
  });

  const byCategory = new Map<string, number>();
  for (const tx of transactions) {
    const cid = tx.categoryId!;
    const prev = byCategory.get(cid) ?? 0;
    byCategory.set(cid, prev + convertAmount(tx.amount, tx.currency, baseCurrency, rates));
  }

  const categories = await prisma.category.findMany({
    where: { id: { in: Array.from(byCategory.keys()) } },
  });

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const total = Array.from(byCategory.values()).reduce((s, v) => s + v, 0);

  return Array.from(byCategory.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([cid, amount]) => {
      const cat = catMap.get(cid);
      return {
        name: cat?.name ?? "Без категории",
        amount,
        color: cat?.color ?? "#6b7280",
        icon: cat?.icon ?? "📌",
        pct: total > 0 ? (amount / total) * 100 : 0,
      };
    });
}

export default async function AnalyticsPage() {
  const [monthlyData, categoryExpenses, baseCurrency] = await Promise.all([
    getMonthlyData(),
    getCategoryExpenses(),
    getBaseCurrency(),
  ]);

  const avgIncome =
    monthlyData.length > 0
      ? monthlyData.reduce((s, d) => s + d.income, 0) / monthlyData.length
      : 0;
  const avgExpense =
    monthlyData.length > 0
      ? monthlyData.reduce((s, d) => s + d.expense, 0) / monthlyData.length
      : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart2 size={22} className="text-yellow-400" />
          Аналитика
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Анализ доходов, расходов и накоплений · все суммы в{" "}
          <span className="text-slate-400 font-medium">{baseCurrency}</span>
        </p>
      </div>

      {/* Средние показатели */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Средний доход / мес</p>
          <p className="text-xl font-bold text-green-400 tabular-nums">
            {formatCurrency(avgIncome)}
          </p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Средние расходы / мес</p>
          <p className="text-xl font-bold text-red-400 tabular-nums">
            {formatCurrency(avgExpense)}
          </p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Средние накопления / мес</p>
          <p
            className={`text-xl font-bold tabular-nums ${
              avgIncome - avgExpense >= 0 ? "text-cyan-400" : "text-red-400"
            }`}
          >
            {formatCurrency(avgIncome - avgExpense)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <MonthlyChart data={monthlyData} />
        </div>
        <div>
          <CategoryBreakdown categories={categoryExpenses} />
        </div>
      </div>
    </div>
  );
}
