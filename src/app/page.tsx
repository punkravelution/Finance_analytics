import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  BarChart2,
} from "lucide-react";
import { getDashboardStats, getVaultSummaries, getRecentTransactions } from "@/lib/analytics";
import { formatCurrency, formatDate, formatDateShort, formatPercent } from "@/lib/format";
import { StatCard } from "@/components/dashboard/StatCard";
import { VaultsList } from "@/components/dashboard/VaultsList";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { CapitalChart } from "@/components/dashboard/CapitalChart";
import { CapitalDynamicsWidgetLazy } from "@/components/dashboard/CapitalDynamicsWidgetLazy";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { Card } from "@/components/ui/card";
import { getTotalMonthlyIncome } from "@/app/actions/recurringIncome";
import { getCapitalHistory, getCapitalWidgetStats } from "@/app/actions/snapshot";
import { getGoalsProgress } from "@/app/actions/goal";
import { getUpcomingExpenses } from "@/app/actions/plannedExpense";
import {
  DashboardGoalsPreview,
  DashboardPlannedPreview,
} from "@/components/dashboard/DashboardGoalsAndPlanned";

export const revalidate = 60;

export default async function HomePage() {
  const [
    stats,
    vaults,
    transactions,
    capitalHistory12,
    capitalWidget,
    recurringIncomeTotals,
    goalsProgress,
    upcomingExpenses,
  ] = await Promise.all([
    getDashboardStats(),
    getVaultSummaries(),
    getRecentTransactions(30),
    getCapitalHistory(12),
    getCapitalWidgetStats(),
    getTotalMonthlyIncome(),
    getGoalsProgress(),
    getUpcomingExpenses(),
  ]);

  const chartData = capitalHistory12.map((d) => ({
    date: formatDateShort(`${d.date}T12:00:00`),
    value: d.total,
  }));

  const topGoals = goalsProgress.filter((g) => !g.isCompleted).slice(0, 3);
  const topPlanned = upcomingExpenses.slice(0, 3);

  const now = new Date();
  const monthName = now.toLocaleString("ru-RU", { month: "long" });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white">Главная панель</h1>
        <p className="text-sm text-slate-500 mt-1">
          {now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Главная карточка — капитал */}
      <div className="mb-5">
        <div className="rounded-xl border border-[hsl(216,34%,17%)] bg-gradient-to-br from-blue-600/10 via-[hsl(222,47%,9%)] to-[hsl(222,47%,8%)] p-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Общий капитал · {stats.currency}
          </p>
          {stats.staleAssetPricesCount > 0 && (
            <p className="mb-3 rounded-md border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              Внимание: {stats.staleAssetPricesCount} актив(ов) имеют устаревшую оценку (старше 7 дней)
              {stats.staleAssetPricesOldestUpdatedAt
                ? `, самое старое обновление: ${formatDate(stats.staleAssetPricesOldestUpdatedAt)}`
                : ", дата обновления не указана"}.
            </p>
          )}
          {stats.assetsMissingValuationCount > 0 && (
            <p className="mb-3 rounded-md border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">
              У {stats.assetsMissingValuationCount} актив(ов) не указана текущая стоимость, капитал может быть занижен.
            </p>
          )}
          <div className="flex items-end gap-4 flex-wrap">
            <p className="text-4xl font-bold tabular-nums text-white">
              {formatCurrency(stats.totalNetWorth)}
            </p>
            <div className="flex items-center gap-2 pb-1">
              {stats.netWorthChange >= 0 ? (
                <TrendingUp size={16} className="text-green-400" />
              ) : (
                <TrendingDown size={16} className="text-red-400" />
              )}
              <span
                className={`text-base font-medium ${
                  stats.netWorthChange >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {stats.netWorthChange >= 0 ? "+" : ""}
                {formatCurrency(stats.netWorthChange)}
              </span>
              <span
                className={`text-sm ${
                  stats.netWorthChange >= 0 ? "text-green-500/70" : "text-red-500/70"
                }`}
              >
                ({formatPercent(stats.netWorthChangePercent)})
              </span>
              <span className="text-xs text-slate-600">за 30 дней</span>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[hsl(216,34%,15%)] flex-wrap">
            <div>
              <p className="text-[11px] text-slate-600">Доступный баланс</p>
              <p className="text-sm font-semibold text-green-400">
                {formatCurrency(stats.spendableBalance)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-600">Ликвидный капитал</p>
              <p className="text-sm font-semibold text-cyan-400">
                {formatCurrency(stats.liquidCapital)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-600">Инвестиций</p>
              <p className="text-sm font-semibold text-slate-300">
                {formatCurrency(stats.totalInvestments)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-600">Хранилищ</p>
              <p className="text-sm font-semibold text-slate-300">{vaults.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Метрики месяца */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          title={`Доходы · ${monthName}`}
          value={formatCurrency(stats.monthlyIncome)}
          icon={<TrendingUp size={16} />}
          accent="green"
        />
        <StatCard
          title={`Расходы · ${monthName}`}
          value={formatCurrency(stats.monthlyExpenses)}
          icon={<TrendingDown size={16} />}
          accent="red"
        />
        <Card>
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Доходы / мес
            </p>
            <div className="p-2 rounded-lg text-green-400 bg-green-500/10">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums text-green-400">
            {formatCurrency(recurringIncomeTotals.totalMonthly, recurringIncomeTotals.currency)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Регулярные поступления</p>
        </Card>
        <StatCard
          title={`Накопления · ${monthName}`}
          value={formatCurrency(stats.monthlySavings)}
          subtitle={
            stats.monthlyIncome > 0
              ? `${((stats.monthlySavings / stats.monthlyIncome) * 100).toFixed(0)}% от дохода`
              : undefined
          }
          icon={<PiggyBank size={16} />}
          accent={stats.monthlySavings >= 0 ? "cyan" : "red"}
        />
        <StatCard
          title="Инвестиции"
          value={formatCurrency(stats.totalInvestments)}
          icon={<BarChart2 size={16} />}
          accent="purple"
        />
      </div>

      <CapitalDynamicsWidgetLazy
        points={capitalWidget.last30}
        monthDelta={capitalWidget.monthDelta}
        currency={capitalWidget.currency}
      />

      {/* Основная сетка */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <div className="xl:col-span-2">
          <CapitalChart data={chartData} />
        </div>
        <div>
          <AllocationChart vaults={vaults} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <DashboardGoalsPreview goals={topGoals} />
        <DashboardPlannedPreview expenses={topPlanned} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <VaultsList vaults={vaults} />
        <RecentTransactions transactions={transactions as Parameters<typeof RecentTransactions>[0]["transactions"]} />
      </div>
    </div>
  );
}
