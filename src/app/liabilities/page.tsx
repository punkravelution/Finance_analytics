import Link from "next/link";
import { HandCoins, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getBaseCurrency, getExchangeRates, convertAmount } from "@/lib/currency";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardStats } from "@/lib/analytics";

export const dynamic = "force-dynamic";

const typeLabel: Record<string, string> = {
  credit_card: "Кредитка",
  installment: "Рассрочка",
  loan: "Займ",
  other: "Другое",
};

export default async function LiabilitiesPage() {
  const [liabilities, baseCurrency, rates, stats] = await Promise.all([
    prisma.liability.findMany({
      orderBy: [{ isActive: "desc" }, { nextPaymentDate: "asc" }],
    }),
    getBaseCurrency(),
    getExchangeRates(),
    getDashboardStats(),
  ]);

  const active = liabilities.filter((l) => l.isActive);

  const totalDebt = active.reduce(
    (sum, l) => sum + convertAmount(l.currentBalance, l.currency, baseCurrency, rates),
    0
  );

  const monthlyMinimum = active.reduce(
    (sum, l) =>
      sum +
      convertAmount(l.minimumPayment ?? 0, l.currency, baseCurrency, rates),
    0
  );

  const upcoming = active
    .filter((l) => l.nextPaymentDate)
    .slice()
    .sort(
      (a, b) =>
        (a.nextPaymentDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.nextPaymentDate?.getTime() ?? Number.MAX_SAFE_INTEGER)
    )
    .slice(0, 5);

  const debtShare =
    stats.totalNetWorth > 0 ? (totalDebt / stats.totalNetWorth) * 100 : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <HandCoins size={22} className="text-rose-400" />
            Долги
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Учёт обязательств и платежной нагрузки
          </p>
        </div>
        <Link
          href="/liabilities/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
        >
          <Plus size={15} />
          Добавить
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-7">
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Общий долг</p>
          <p className="text-xl font-bold text-rose-300">{formatCurrency(totalDebt, baseCurrency)}</p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Мин. нагрузка в месяц</p>
          <p className="text-xl font-bold text-amber-300">
            {formatCurrency(monthlyMinimum, baseCurrency)}
          </p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Ближайшие платежи</p>
          <p className="text-xl font-bold text-white">{upcoming.length}</p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Доля в капитале</p>
          <p className="text-xl font-bold text-white">{debtShare.toFixed(1)}%</p>
        </div>
      </div>

      <div className="space-y-2 mb-7">
        {upcoming.map((l) => (
          <div
            key={`up-${l.id}`}
            className="px-3 py-2 rounded-lg border border-[hsl(216,34%,17%)] text-sm text-slate-300 flex items-center justify-between"
          >
            <span>
              {l.name} · {l.nextPaymentDate ? formatDate(l.nextPaymentDate) : "дата не задана"}
            </span>
            <span className="font-medium">
              {formatCurrency(l.minimumPayment ?? 0, l.currency)}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {liabilities.map((l) => (
          <Link key={l.id} href={`/liabilities/${l.id}/edit`} className="block">
            <Card className="hover:border-[hsl(216,34%,28%)] transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium">{l.name}</p>
                      <Badge variant="outline">{typeLabel[l.type] ?? l.type}</Badge>
                      <Badge variant={l.isActive ? "danger" : "default"}>
                        {l.isActive ? "Активен" : "Закрыт / отключен"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Ставка: {l.interestRate != null ? `${l.interestRate}%` : "—"} · Мин. платёж:{" "}
                      {formatCurrency(l.minimumPayment ?? 0, l.currency)}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Следующий платёж: {l.nextPaymentDate ? formatDate(l.nextPaymentDate) : "не задан"}
                      {l.lender ? ` · Кредитор: ${l.lender}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white font-semibold tabular-nums">
                      {formatCurrency(l.currentBalance, l.currency)}
                    </p>
                    <p className="text-xs text-slate-500">остаток</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
