import Link from "next/link";
import { RefreshCcw, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getBaseCurrency, getExchangeRates, convertAmount } from "@/lib/currency";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const periodLabel: Record<string, string> = {
  monthly: "Ежемесячно",
  quarterly: "Ежеквартально",
  yearly: "Ежегодно",
};

function monthlyFactor(period: string): number {
  if (period === "quarterly") return 1 / 3;
  if (period === "yearly") return 1 / 12;
  return 1;
}

export default async function SubscriptionsPage() {
  const [subs, baseCurrency, rates] = await Promise.all([
    prisma.subscription.findMany({
      include: { vault: true },
      orderBy: [{ isActive: "desc" }, { nextChargeDate: "asc" }],
    }),
    getBaseCurrency(),
    getExchangeRates(),
  ]);

  const monthlyTotal = subs
    .filter((s) => s.isActive)
    .reduce(
      (sum, s) =>
        sum +
        convertAmount(s.amount * monthlyFactor(s.billingPeriod), s.currency, baseCurrency, rates),
      0
    );

  const monthlyEssential = subs
    .filter((s) => s.isActive && s.isEssential)
    .reduce(
      (sum, s) =>
        sum +
        convertAmount(s.amount * monthlyFactor(s.billingPeriod), s.currency, baseCurrency, rates),
      0
    );

  const upcoming = subs
    .filter((s) => s.isActive)
    .slice()
    .sort((a, b) => a.nextChargeDate.getTime() - b.nextChargeDate.getTime())
    .slice(0, 5);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <RefreshCcw size={22} className="text-cyan-400" />
            Подписки
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Регулярные платежи и ежемесячная нагрузка
          </p>
        </div>
        <Link
          href="/subscriptions/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
        >
          <Plus size={15} />
          Добавить
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Нагрузка в месяц</p>
          <p className="text-xl font-bold text-white">{formatCurrency(monthlyTotal, baseCurrency)}</p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Обязательные в месяц</p>
          <p className="text-xl font-bold text-amber-300">
            {formatCurrency(monthlyEssential, baseCurrency)}
          </p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Ближайших списаний</p>
          <p className="text-xl font-bold text-white">{upcoming.length}</p>
        </div>
      </div>

      <div className="space-y-2 mb-7">
        {upcoming.map((s) => (
          <div
            key={`up-${s.id}`}
            className="px-3 py-2 rounded-lg border border-[hsl(216,34%,17%)] text-sm text-slate-300 flex items-center justify-between"
          >
            <span>
              {s.name} · {formatDate(s.nextChargeDate)}
            </span>
            <span className="font-medium">{formatCurrency(s.amount, s.currency)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {subs.map((s) => (
          <Link key={s.id} href={`/subscriptions/${s.id}/edit`} className="block">
            <Card className="hover:border-[hsl(216,34%,28%)] transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium">{s.name}</p>
                      <Badge variant={s.isActive ? "success" : "default"}>
                        {s.isActive ? "Активна" : "Отключена"}
                      </Badge>
                      <Badge variant={s.isEssential ? "warning" : "outline"}>
                        {s.isEssential ? "Обязательная" : "Необязательная"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {periodLabel[s.billingPeriod] ?? s.billingPeriod} · Следующее списание:{" "}
                      {formatDate(s.nextChargeDate)}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Категория: {s.category} · Хранилище: {s.vault.name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white font-semibold tabular-nums">
                      {formatCurrency(s.amount, s.currency)}
                    </p>
                    <p className="text-xs text-slate-500">{s.currency}</p>
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
