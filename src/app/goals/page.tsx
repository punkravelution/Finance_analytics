import {
  getGoalsProgress,
} from "@/app/actions/goal";
import { prisma } from "@/lib/prisma";
import { getBaseCurrency, getExchangeRates, convertAmount } from "@/lib/currency";
import { formatCurrency } from "@/lib/format";
import {
  getPlannedExpenses,
  getUnpaidTotalsForNextThreeMonths,
} from "@/app/actions/plannedExpense";
import { groupPlannedExpensesByMonth } from "@/lib/groupPlannedByMonth";
import { GoalsTabsLayout } from "@/components/goals/GoalsTabsLayout";
import { GoalsAccumulationTab } from "@/components/goals/GoalsAccumulationTab";
import { PlannedPaymentsTab } from "@/components/goals/PlannedPaymentsTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface GoalsForecastSummary {
  baseCurrency: string;
  fcf: number;
  totalGoalsNeedPerMonth: number;
  deficit: number;
  distribution: {
    avalancheDebtName: string | null;
    toAvalancheDebt: number;
    nearestGoalName: string | null;
    toNearestGoal: number;
    remainder: number;
  };
}

async function getGoalsForecastSummary(
  goalsProgress: Awaited<ReturnType<typeof getGoalsProgress>>
): Promise<GoalsForecastSummary> {
  const [baseCurrency, rates, recurring, subscriptions, liabilities] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
    prisma.recurringIncome.findMany({
      where: { isActive: true },
      select: { amount: true, currency: true, billingPeriod: true },
    }),
    prisma.subscription.findMany({
      where: { isActive: true },
      select: { amount: true, currency: true, billingPeriod: true },
    }),
    prisma.liability.findMany({
      where: { isActive: true, currentBalance: { gt: 0 } },
      select: { name: true, currentBalance: true, currency: true, interestRate: true, minimumPayment: true },
    }),
  ]);

  const monthlyFactor = (period: string): number => {
    if (period === "weekly") return 52 / 12;
    if (period === "biweekly") return 26 / 12;
    if (period === "quarterly") return 1 / 3;
    if (period === "yearly") return 1 / 12;
    return 1;
  };

  const monthlyIncome = recurring.reduce(
    (sum, row) =>
      sum + convertAmount(row.amount * monthlyFactor(row.billingPeriod), row.currency, baseCurrency, rates),
    0
  );
  const monthlySubscriptions = subscriptions.reduce(
    (sum, row) =>
      sum + convertAmount(row.amount * monthlyFactor(row.billingPeriod), row.currency, baseCurrency, rates),
    0
  );
  const monthlyDebtMin = liabilities.reduce(
    (sum, row) => sum + convertAmount(row.minimumPayment ?? 0, row.currency, baseCurrency, rates),
    0
  );
  const fcf = monthlyIncome - monthlySubscriptions - monthlyDebtMin;

  const totalGoalsNeedPerMonth = goalsProgress.reduce((sum, goal) => {
    const need = goal.monthlyRequired ?? 0;
    return sum + convertAmount(need, goal.currency, baseCurrency, rates);
  }, 0);
  const deficit = totalGoalsNeedPerMonth - fcf;

  const avalancheDebt = liabilities
    .filter((l) => l.interestRate != null)
    .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0] ?? null;
  const nearestGoal = goalsProgress
    .filter((g) => !g.isCompleted)
    .slice()
    .sort((a, b) => {
      const ad = a.targetDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const bd = b.targetDate?.getTime() ?? Number.POSITIVE_INFINITY;
      return ad - bd;
    })[0] ?? null;

  const distributable = Math.max(0, fcf);
  const toAvalancheDebt = distributable * 0.5;
  const toNearestGoal = distributable * 0.4;
  const remainder = Math.max(0, distributable - toAvalancheDebt - toNearestGoal);

  return {
    baseCurrency,
    fcf,
    totalGoalsNeedPerMonth,
    deficit,
    distribution: {
      avalancheDebtName: avalancheDebt?.name ?? null,
      toAvalancheDebt,
      nearestGoalName: nearestGoal?.name ?? null,
      toNearestGoal,
      remainder,
    },
  };
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function GoalsPage({ searchParams }: PageProps) {
  const { tab } = await searchParams;
  const defaultTab: "goals" | "planned" = tab === "planned" ? "planned" : "goals";

  const [goalsProgress, plannedRows, threeMonthTotals] = await Promise.all([
    getGoalsProgress(),
    getPlannedExpenses(),
    getUnpaidTotalsForNextThreeMonths(),
  ]);
  const forecast = await getGoalsForecastSummary(goalsProgress);

  const groups = groupPlannedExpensesByMonth(plannedRows);
  const now = new Date();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-7">Цели и платежи</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Прогноз по целям с распределением</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>
            Текущий FCF:{" "}
            <span className={forecast.fcf >= 0 ? "text-cyan-400 font-semibold" : "text-red-400 font-semibold"}>
              {formatCurrency(forecast.fcf, forecast.baseCurrency)}/мес
            </span>
          </p>
          <p>
            Для всех целей нужно:{" "}
            <span className="font-semibold">{formatCurrency(forecast.totalGoalsNeedPerMonth, forecast.baseCurrency)}/мес</span>
            {" — "}
            {forecast.deficit > 0 ? (
              <span className="text-amber-300">дефицит {formatCurrency(forecast.deficit, forecast.baseCurrency)}</span>
            ) : (
              <span className="text-green-400">запас {formatCurrency(Math.abs(forecast.deficit), forecast.baseCurrency)}</span>
            )}
          </p>
          <p>
            Автоматическое распределение:{" "}
            {forecast.distribution.avalancheDebtName
              ? `${formatCurrency(forecast.distribution.toAvalancheDebt, forecast.baseCurrency)} на ${forecast.distribution.avalancheDebtName} (лавина)`
              : `долгов нет (${formatCurrency(0, forecast.baseCurrency)})`}
            {", "}
            {forecast.distribution.nearestGoalName
              ? `${formatCurrency(forecast.distribution.toNearestGoal, forecast.baseCurrency)} на ${forecast.distribution.nearestGoalName} (ближайший дедлайн)`
              : `целей с дедлайном нет (${formatCurrency(0, forecast.baseCurrency)})`}
            {`, ${formatCurrency(forecast.distribution.remainder, forecast.baseCurrency)} остаток`}
          </p>
        </CardContent>
      </Card>
      <GoalsTabsLayout
        defaultTab={defaultTab}
        goalsTab={<GoalsAccumulationTab goals={goalsProgress} />}
        plannedTab={
          <PlannedPaymentsTab groups={groups} threeMonthTotals={threeMonthTotals} now={now} />
        }
      />
    </div>
  );
}
