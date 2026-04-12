import {
  getGoalsProgress,
} from "@/app/actions/goal";
import {
  getPlannedExpenses,
  getUnpaidTotalsForNextThreeMonths,
} from "@/app/actions/plannedExpense";
import { groupPlannedExpensesByMonth } from "@/lib/groupPlannedByMonth";
import { GoalsTabsLayout } from "@/components/goals/GoalsTabsLayout";
import { GoalsAccumulationTab } from "@/components/goals/GoalsAccumulationTab";
import { PlannedPaymentsTab } from "@/components/goals/PlannedPaymentsTab";

export const dynamic = "force-dynamic";

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

  const groups = groupPlannedExpensesByMonth(plannedRows);
  const now = new Date();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-7">Цели и платежи</h1>
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
