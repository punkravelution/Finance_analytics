import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart2 } from "lucide-react";
import { MonthlyChart } from "@/components/analytics/MonthlyChart";
import { CategoryBreakdown } from "@/components/analytics/CategoryBreakdown";
import { getExchangeRates, getBaseCurrency, convertAmount } from "@/lib/currency";
import { getVaultSummaries } from "@/lib/analytics";

export const dynamic = "force-dynamic";

function monthlyFactor(period: string): number {
  if (period === "weekly") return 52 / 12;
  if (period === "biweekly") return 26 / 12;
  if (period === "quarterly") return 1 / 3;
  if (period === "yearly") return 1 / 12;
  return 1;
}

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
    },
    select: { categoryId: true, amount: true, currency: true },
  });

  let uncategorizedAmount = 0;
  const byCategory = new Map<string, number>();
  for (const tx of transactions) {
    const amountBase = convertAmount(tx.amount, tx.currency, baseCurrency, rates);
    if (tx.categoryId == null) {
      uncategorizedAmount += amountBase;
    } else {
      byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0) + amountBase);
    }
  }

  const categories = await prisma.category.findMany({
    where: { id: { in: Array.from(byCategory.keys()) } },
  });

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const total = Array.from(byCategory.values()).reduce((s, v) => s + v, 0) + uncategorizedAmount;

  const rows = Array.from(byCategory.entries())
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

  if (uncategorizedAmount > 0) {
    rows.push({
      name: "Без категории",
      amount: uncategorizedAmount,
      color: "#6b7280",
      icon: "❓",
      pct: total > 0 ? (uncategorizedAmount / total) * 100 : 0,
    });
  }

  return rows;
}

async function getNextMonthForecast(baseCurrency: string) {
  const rates = await getExchangeRates();
  const [incomes, subscriptions] = await Promise.all([
    prisma.recurringIncome.findMany({
      where: { isActive: true },
      select: { amount: true, currency: true, billingPeriod: true },
    }),
    prisma.subscription.findMany({
      where: { isActive: true },
      select: { amount: true, currency: true, billingPeriod: true },
    }),
  ]);

  const nextMonthIncome = incomes.reduce((sum, row) => {
    const monthlyNative = row.amount * monthlyFactor(row.billingPeriod);
    return sum + convertAmount(monthlyNative, row.currency, baseCurrency, rates);
  }, 0);

  const nextMonthCharges = subscriptions.reduce((sum, row) => {
    const monthlyNative = row.amount * monthlyFactor(row.billingPeriod);
    return sum + convertAmount(monthlyNative, row.currency, baseCurrency, rates);
  }, 0);

  return {
    nextMonthIncome,
    nextMonthCharges,
    nextMonthNet: nextMonthIncome - nextMonthCharges,
  };
}

async function getAlerts(baseCurrency: string) {
  const rates = await getExchangeRates();
  const now = new Date();
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);
  const weekAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const [subsTomorrow, overdueLiabilities, goalsSoon, settings, vaults] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        isActive: true,
        nextChargeDate: { gte: tomorrowStart, lte: tomorrowEnd },
      },
      select: { id: true, name: true, amount: true, currency: true, nextChargeDate: true },
      orderBy: { nextChargeDate: "asc" },
      take: 10,
    }),
    prisma.liability.findMany({
      where: {
        isActive: true,
        currentBalance: { gt: 0 },
        nextPaymentDate: { lt: todayStart },
      },
      select: { id: true, name: true, currentBalance: true, currency: true, nextPaymentDate: true },
      orderBy: { nextPaymentDate: "asc" },
      take: 10,
    }),
    prisma.goal.findMany({
      where: {
        isCompleted: false,
        targetDate: { gte: todayStart, lte: weekAhead },
      },
      select: { id: true, name: true, targetDate: true, currentAmount: true, targetAmount: true, currency: true },
      orderBy: { targetDate: "asc" },
      take: 10,
    }),
    prisma.appSettings.findMany({
      where: { key: { in: ["alerts.lowBalanceThreshold", "alerts.lowBalanceThresholdBase"] } },
      select: { key: true, value: true },
    }),
    getVaultSummaries(),
  ]);

  const thresholdSetting = settings.find((s) => s.key === "alerts.lowBalanceThreshold");
  const threshold = thresholdSetting ? Number.parseFloat(thresholdSetting.value) : 0;
  const lowBalanceVaults =
    Number.isFinite(threshold) && threshold > 0
      ? vaults
          .filter((v) => v.balanceInBaseCurrency < threshold)
          .map((v) => ({
            id: v.id,
            name: v.name,
            balanceInBase: v.balanceInBaseCurrency,
          }))
      : [];

  const subscriptionsTomorrow = subsTomorrow.map((s) => ({
    ...s,
    amountBase: convertAmount(s.amount, s.currency, baseCurrency, rates),
  }));
  const overdueDebt = overdueLiabilities.map((l) => ({
    ...l,
    balanceBase: convertAmount(l.currentBalance, l.currency, baseCurrency, rates),
  }));
  const goalDeadlines = goalsSoon.map((g) => ({
    ...g,
    remainingBase: convertAmount(Math.max(0, g.targetAmount - g.currentAmount), g.currency, baseCurrency, rates),
  }));

  return { subscriptionsTomorrow, overdueDebt, goalDeadlines, lowBalanceVaults, lowBalanceThreshold: threshold };
}

async function getPeriodComparisons(baseCurrency: string) {
  const rates = await getExchangeRates();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastYearMonthStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const lastYearMonthEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);

  const [thisMonth, sameMonthLastYear, last24m] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: monthStart, lt: nextMonthStart }, type: { in: ["income", "expense"] } },
      select: { type: true, amount: true, currency: true, date: true },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: lastYearMonthStart, lt: lastYearMonthEnd }, type: { in: ["income", "expense"] } },
      select: { type: true, amount: true, currency: true, date: true },
    }),
    prisma.transaction.findMany({
      where: {
        date: { gte: new Date(now.getFullYear() - 2, now.getMonth(), 1) },
        type: { in: ["income", "expense"] },
      },
      select: { type: true, amount: true, currency: true, date: true },
    }),
  ]);

  const sumByType = (rows: typeof thisMonth) =>
    rows.reduce(
      (acc, row) => {
        const v = convertAmount(row.amount, row.currency, baseCurrency, rates);
        if (row.type === "income") acc.income += v;
        else acc.expense += v;
        return acc;
      },
      { income: 0, expense: 0 }
    );

  const thisMonthSum = sumByType(thisMonth);
  const sameMonthLastYearSum = sumByType(sameMonthLastYear);

  const quarterMap = new Map<string, { income: number; expense: number }>();
  for (const row of last24m) {
    const q = Math.floor(row.date.getMonth() / 3) + 1;
    const key = `${row.date.getFullYear()}-Q${q}`;
    const curr = quarterMap.get(key) ?? { income: 0, expense: 0 };
    const v = convertAmount(row.amount, row.currency, baseCurrency, rates);
    if (row.type === "income") curr.income += v;
    else curr.expense += v;
    quarterMap.set(key, curr);
  }
  const quarterlyTrends = Array.from(quarterMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-4)
    .map(([period, value]) => ({ period, ...value, savings: value.income - value.expense }));

  const seasonality = new Map<number, { income: number; expense: number; months: number }>();
  for (const row of last24m) {
    const month = row.date.getMonth();
    const curr = seasonality.get(month) ?? { income: 0, expense: 0, months: 0 };
    const v = convertAmount(row.amount, row.currency, baseCurrency, rates);
    if (row.type === "income") curr.income += v;
    else curr.expense += v;
    curr.months += 1;
    seasonality.set(month, curr);
  }
  const seasonalTopExpenseMonths = Array.from(seasonality.entries())
    .map(([month, value]) => ({
      month,
      avgExpense: value.months > 0 ? value.expense / value.months : 0,
    }))
    .sort((a, b) => b.avgExpense - a.avgExpense)
    .slice(0, 3)
    .map((item) =>
      new Date(2000, item.month, 1).toLocaleDateString("ru-RU", { month: "long" })
    );

  return { thisMonthSum, sameMonthLastYearSum, quarterlyTrends, seasonalTopExpenseMonths };
}

async function getScenarioAndInvestmentInsights(baseCurrency: string) {
  const rates = await getExchangeRates();
  const [monthlyRows, liabilities, assets, incomeEvents] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        date: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1) },
        type: { in: ["income", "expense"] },
      },
      select: { type: true, amount: true, currency: true },
    }),
    prisma.liability.findMany({
      where: { isActive: true, currentBalance: { gt: 0 } },
      select: { currentBalance: true, minimumPayment: true, currency: true },
    }),
    prisma.asset.findMany({
      where: { isActive: true, averageBuyPrice: { not: null }, currentUnitPrice: { not: null } },
      select: { quantity: true, averageBuyPrice: true, currentUnitPrice: true, currency: true },
    }),
    prisma.incomeEvent.findMany({
      where: {
        date: { gte: new Date(new Date().getFullYear() - 1, new Date().getMonth(), new Date().getDate()) },
        incomeType: { in: ["dividend", "coupon"] },
      },
      select: { amount: true, currency: true },
    }),
  ]);

  const sums = monthlyRows.reduce(
    (acc, row) => {
      const v = convertAmount(row.amount, row.currency, baseCurrency, rates);
      if (row.type === "income") acc.income += v;
      else acc.expense += v;
      return acc;
    },
    { income: 0, expense: 0, count: Math.max(1, monthlyRows.length / 20) }
  );
  const avgIncome = sums.income / sums.count;
  const avgExpense = sums.expense / sums.count;
  const currentSavings = avgIncome - avgExpense;
  const scenarioExpense = avgExpense * 0.8;
  const scenarioSavings = avgIncome - scenarioExpense;

  const debtBase = liabilities.reduce(
    (sum, l) => sum + convertAmount(l.currentBalance, l.currency, baseCurrency, rates),
    0
  );
  const minPaymentBase = liabilities.reduce((sum, l) => {
    const mp = l.minimumPayment ?? 0;
    return sum + convertAmount(mp, l.currency, baseCurrency, rates);
  }, 0);
  const acceleratedPayment = minPaymentBase * 1.2;
  const debtMonthsAtMin = minPaymentBase > 0 ? debtBase / minPaymentBase : null;
  const debtMonthsAtPlus20 = acceleratedPayment > 0 ? debtBase / acceleratedPayment : null;

  let investedBase = 0;
  let currentBase = 0;
  for (const a of assets) {
    const avg = a.averageBuyPrice ?? 0;
    const cur = a.currentUnitPrice ?? 0;
    const investedNative = a.quantity * avg;
    const currentNative = a.quantity * cur;
    investedBase += convertAmount(investedNative, a.currency, baseCurrency, rates);
    currentBase += convertAmount(currentNative, a.currency, baseCurrency, rates);
  }
  const unrealizedReturnPct = investedBase > 0 ? ((currentBase - investedBase) / investedBase) * 100 : null;
  const dividendsCoupons12m = incomeEvents.reduce(
    (sum, row) => sum + convertAmount(row.amount, row.currency, baseCurrency, rates),
    0
  );

  return {
    scenario: { currentSavings, scenarioSavings, delta: scenarioSavings - currentSavings },
    debtPlan: { debtMonthsAtMin, debtMonthsAtPlus20 },
    investments: { investedBase, currentBase, unrealizedReturnPct, dividendsCoupons12m },
  };
}

async function getFinancialHealthcheck(baseCurrency: string) {
  const rates = await getExchangeRates();
  const since90 = new Date();
  since90.setDate(since90.getDate() - 90);

  const [vaults, recurring, subscriptions, liabilities, tx90, goals] = await Promise.all([
    getVaultSummaries(),
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
      select: { minimumPayment: true, currency: true },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: since90 }, type: { in: ["income", "expense"] } },
      select: { type: true, amount: true, currency: true },
    }),
    prisma.goal.findMany({
      where: { isCompleted: false },
      select: { targetAmount: true, currentAmount: true, currency: true },
    }),
  ]);

  const liquidBalance = vaults
    .filter((v) => v.liquidityLevel === "high")
    .reduce((sum, v) => sum + v.balanceInBaseCurrency, 0);

  const monthlyIncome = recurring.reduce(
    (sum, r) => sum + convertAmount(r.amount * monthlyFactor(r.billingPeriod), r.currency, baseCurrency, rates),
    0
  );
  const monthlySubscriptions = subscriptions.reduce(
    (sum, s) => sum + convertAmount(s.amount * monthlyFactor(s.billingPeriod), s.currency, baseCurrency, rates),
    0
  );
  const monthlyDebtPayments = liabilities.reduce(
    (sum, l) => sum + convertAmount(l.minimumPayment ?? 0, l.currency, baseCurrency, rates),
    0
  );

  let income90 = 0;
  let expense90 = 0;
  for (const tx of tx90) {
    const value = convertAmount(tx.amount, tx.currency, baseCurrency, rates);
    if (tx.type === "income") income90 += value;
    else expense90 += value;
  }
  const monthlyExpense = expense90 / 3;
  const cushionMonths = monthlyExpense > 0 ? liquidBalance / monthlyExpense : 0;
  const debtLoadPct = monthlyIncome > 0 ? (monthlyDebtPayments / monthlyIncome) * 100 : 0;
  const savingsRatePct = income90 > 0 ? ((income90 - expense90) / income90) * 100 : 0;
  const fcf = monthlyIncome - monthlySubscriptions - monthlyDebtPayments;

  const goalsNeedTotal = goals.reduce(
    (sum, g) => sum + convertAmount(Math.max(0, g.targetAmount - g.currentAmount), g.currency, baseCurrency, rates),
    0
  );
  const goalsCoverageMonths = fcf > 0 ? goalsNeedTotal / fcf : null;

  const cushionStatus = cushionMonths >= 3 ? "✅" : cushionMonths >= 1 ? "⚠️" : "❌";
  const debtStatus = debtLoadPct <= 30 ? "✅" : debtLoadPct <= 40 ? "⚠️" : "❌";
  const savingsStatus = savingsRatePct >= 20 ? "✅" : savingsRatePct >= 10 ? "⚠️" : "❌";

  return {
    liquidBalance,
    monthlyExpense,
    cushionMonths,
    cushionStatus,
    debtLoadPct,
    debtStatus,
    savingsRatePct,
    savingsStatus,
    fcf,
    goalsCoverageMonths,
  };
}

export default async function AnalyticsPage() {
  const [monthlyData, categoryExpenses, baseCurrency] = await Promise.all([
    getMonthlyData(),
    getCategoryExpenses(),
    getBaseCurrency(),
  ]);
  const [forecast, alerts, comparisons, scenarioInsights, healthcheck] = await Promise.all([
    getNextMonthForecast(baseCurrency),
    getAlerts(baseCurrency),
    getPeriodComparisons(baseCurrency),
    getScenarioAndInvestmentInsights(baseCurrency),
    getFinancialHealthcheck(baseCurrency),
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
        <Card>
          <CardHeader>
            <CardTitle>Прогноз на следующий месяц</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            <p>Поступит: <span className="text-green-400 font-semibold">{formatCurrency(forecast.nextMonthIncome, baseCurrency)}</span></p>
            <p>Спишется: <span className="text-red-400 font-semibold">{formatCurrency(forecast.nextMonthCharges, baseCurrency)}</span></p>
            <p>Прогнозный чистый поток: <span className={forecast.nextMonthNet >= 0 ? "text-cyan-400 font-semibold" : "text-red-400 font-semibold"}>{formatCurrency(forecast.nextMonthNet, baseCurrency)}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Уведомления и алерты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div>
              <p className="text-slate-400">Подписки завтра: {alerts.subscriptionsTomorrow.length}</p>
              {alerts.subscriptionsTomorrow.slice(0, 3).map((s) => (
                <p key={s.id}>• {s.name} — {formatCurrency(s.amountBase, baseCurrency)}</p>
              ))}
            </div>
            <div>
              <p className="text-slate-400">Просроченные долги: {alerts.overdueDebt.length}</p>
              {alerts.overdueDebt.slice(0, 3).map((d) => (
                <p key={d.id}>• {d.name} — {formatCurrency(d.balanceBase, baseCurrency)}</p>
              ))}
            </div>
            <div>
              <p className="text-slate-400">Дедлайн цели ≤ 7 дней: {alerts.goalDeadlines.length}</p>
              {alerts.goalDeadlines.slice(0, 3).map((g) => (
                <p key={g.id}>• {g.name} — осталось {formatCurrency(g.remainingBase, baseCurrency)}</p>
              ))}
            </div>
            <div>
              <p className="text-slate-400">
                Низкий баланс (порог {alerts.lowBalanceThreshold > 0 ? formatCurrency(alerts.lowBalanceThreshold, baseCurrency) : "не задан"}): {alerts.lowBalanceVaults.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
        <Card>
          <CardHeader>
            <CardTitle>Финансовый healthcheck</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            <p>
              {healthcheck.cushionStatus} Подушка безопасности:{" "}
              {healthcheck.cushionMonths.toFixed(1)} мес
              <span className="text-slate-500"> = ликвидный баланс / средний расход</span>
            </p>
            <p>
              {healthcheck.debtStatus} Долговая нагрузка: {healthcheck.debtLoadPct.toFixed(1)}%
              <span className="text-slate-500"> = платежи по долгам / доход</span>
            </p>
            <p>
              {healthcheck.savingsStatus} Норма сбережений: {healthcheck.savingsRatePct.toFixed(1)}%
              <span className="text-slate-500"> = (доход - расход) / доход</span>
            </p>
            <p>
              Свободный поток: <span className="font-semibold text-cyan-400">{formatCurrency(healthcheck.fcf, baseCurrency)}</span>
              <span className="text-slate-500"> = доход - подписки - мин. платежи</span>
            </p>
            <p>
              Покрытие целей:{" "}
              {healthcheck.goalsCoverageMonths == null
                ? "н/д (FCF <= 0)"
                : `${healthcheck.goalsCoverageMonths.toFixed(1)} мес`}
              <span className="text-slate-500"> при текущем FCF</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Сравнение периодов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            <p>Этот месяц: доход {formatCurrency(comparisons.thisMonthSum.income, baseCurrency)}, расход {formatCurrency(comparisons.thisMonthSum.expense, baseCurrency)}</p>
            <p>Тот же месяц год назад: доход {formatCurrency(comparisons.sameMonthLastYearSum.income, baseCurrency)}, расход {formatCurrency(comparisons.sameMonthLastYearSum.expense, baseCurrency)}</p>
            <p className="text-slate-400">Квартальный тренд (последние 4 квартала):</p>
            {comparisons.quarterlyTrends.map((q) => (
              <p key={q.period}>• {q.period}: накопления {formatCurrency(q.savings, baseCurrency)}</p>
            ))}
            <p className="text-slate-400">Сезонно самые затратные месяцы: {comparisons.seasonalTopExpenseMonths.join(", ") || "недостаточно данных"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Сценарии и доходность инвестиций</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            <p>Сценарий «расходы -20%»: накопления изменятся на <span className="text-cyan-400 font-semibold">{formatCurrency(scenarioInsights.scenario.delta, baseCurrency)}</span> в месяц.</p>
            <p>Долги: при мин. платеже срок ≈ {scenarioInsights.debtPlan.debtMonthsAtMin ? `${scenarioInsights.debtPlan.debtMonthsAtMin.toFixed(1)} мес` : "н/д"}, при +20% платеже ≈ {scenarioInsights.debtPlan.debtMonthsAtPlus20 ? `${scenarioInsights.debtPlan.debtMonthsAtPlus20.toFixed(1)} мес` : "н/д"}.</p>
            <p>Инвестировано: {formatCurrency(scenarioInsights.investments.investedBase, baseCurrency)}; текущая оценка: {formatCurrency(scenarioInsights.investments.currentBase, baseCurrency)}.</p>
            <p>Оценка доходности (unrealized): {scenarioInsights.investments.unrealizedReturnPct != null ? `${scenarioInsights.investments.unrealizedReturnPct.toFixed(2)}%` : "н/д"}.</p>
            <p>Дивиденды/купоны за 12 мес: {formatCurrency(scenarioInsights.investments.dividendsCoupons12m, baseCurrency)}.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
