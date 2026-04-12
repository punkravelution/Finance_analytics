import { CapitalHistoryView } from "@/components/capital-history/CapitalHistoryView";
import {
  getCapitalGrowth,
  getCapitalHistory,
  getMonthlyCapitalTableRows,
} from "@/app/actions/snapshot";
import { getBaseCurrency } from "@/lib/currency";

export const dynamic = "force-dynamic";

export default async function CapitalHistoryPage() {
  const [history, growth, monthlyTable, baseCurrency] = await Promise.all([
    getCapitalHistory(12),
    getCapitalGrowth(12),
    getMonthlyCapitalTableRows(),
    getBaseCurrency(),
  ]);

  return (
    <CapitalHistoryView
      initialHistory={history}
      initialGrowth={growth}
      initialPeriod={12}
      monthlyTable={monthlyTable}
      baseCurrency={baseCurrency}
    />
  );
}
