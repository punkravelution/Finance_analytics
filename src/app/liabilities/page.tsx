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

const EXTRA_PAYMENT_BASE = 10000;

interface PayoffSimulation {
  months: number | null;
  interestPaid: number;
}

function simulateDebtPayoff(balance: number, annualRatePct: number | null, monthlyPayment: number): PayoffSimulation {
  if (!Number.isFinite(balance) || balance <= 0 || !Number.isFinite(monthlyPayment) || monthlyPayment <= 0) {
    return { months: null, interestPaid: 0 };
  }
  const monthlyRate = annualRatePct != null && Number.isFinite(annualRatePct) ? annualRatePct / 100 / 12 : 0;
  let remaining = balance;
  let interestPaid = 0;
  let months = 0;
  const maxMonths = 1200;

  while (remaining > 0 && months < maxMonths) {
    const interestPart = monthlyRate > 0 ? remaining * monthlyRate : 0;
    const principalPart = monthlyPayment - interestPart;
    if (principalPart <= 0) {
      return { months: null, interestPaid };
    }
    interestPaid += interestPart;
    remaining -= principalPart;
    months += 1;
  }

  if (remaining > 0) {
    return { months: null, interestPaid };
  }
  return { months, interestPaid };
}

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

  const activeSortedByRate = active
    .filter((l) => l.interestRate != null && Number.isFinite(l.interestRate))
    .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
  const avalancheTarget = activeSortedByRate[0] ?? null;
  const snowballTarget =
    active
      .slice()
      .sort(
        (a, b) =>
          convertAmount(a.currentBalance, a.currency, baseCurrency, rates) -
          convertAmount(b.currentBalance, b.currency, baseCurrency, rates)
      )[0] ?? null;

  const enriched = liabilities.map((l) => {
    const balanceBase = convertAmount(l.currentBalance, l.currency, baseCurrency, rates);
    const minPaymentBase = convertAmount(l.minimumPayment ?? 0, l.currency, baseCurrency, rates);
    const minSim = simulateDebtPayoff(balanceBase, l.interestRate, minPaymentBase);
    const boostedSim = simulateDebtPayoff(
      balanceBase,
      l.interestRate,
      minPaymentBase + EXTRA_PAYMENT_BASE
    );
    const monthsSaved =
      minSim.months != null && boostedSim.months != null ? minSim.months - boostedSim.months : null;
    const interestSaved = Math.max(0, minSim.interestPaid - boostedSim.interestPaid);
    return {
      ...l,
      minSim,
      boostedSim,
      monthsSaved,
      interestSaved,
    };
  });

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
        {enriched.map((l) => (
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
                    <div className="mt-2 rounded-md border border-[hsl(216,34%,17%)] bg-[hsl(222,47%,9%)] p-2 text-xs text-slate-300 space-y-1">
                      <p>
                        При минимальных платежах:{" "}
                        {l.minSim.months == null
                          ? "срок не определяется (платёж слишком мал)"
                          : `погасится через ${l.minSim.months} мес, переплата ${formatCurrency(l.minSim.interestPaid, baseCurrency)}`}
                      </p>
                      <p>
                        При +{formatCurrency(EXTRA_PAYMENT_BASE, baseCurrency)}/мес:{" "}
                        {l.boostedSim.months == null
                          ? "срок не определяется"
                          : `погасится через ${l.boostedSim.months} мес${l.monthsSaved != null ? ` (на ${l.monthsSaved} мес быстрее)` : ""}, экономия ${formatCurrency(l.interestSaved, baseCurrency)}`}
                      </p>
                      <p>
                        Рекомендация:{" "}
                        {avalancheTarget && snowballTarget
                          ? `лавина — сначала '${avalancheTarget.name}' (${avalancheTarget.interestRate?.toFixed(1)}%); снежный ком — сначала '${snowballTarget.name}'.`
                          : "недостаточно данных для выбора лавины/снежного кома."}
                      </p>
                    </div>
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
