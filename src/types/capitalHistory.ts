export type CapitalHistoryVaultSlice = {
  vaultId: string;
  name: string;
  balance: number;
};

export type CapitalHistoryDay = {
  date: string;
  total: number;
  byVault: CapitalHistoryVaultSlice[];
};

export type CapitalGrowthMetrics = {
  startValue: number;
  currentValue: number;
  absoluteGrowth: number;
  percentGrowth: number | null;
  bestMonth: { label: string; delta: number } | null;
  worstMonth: { label: string; delta: number } | null;
  currency: string;
};

export type MonthlyCapitalRow = {
  monthKey: string;
  label: string;
  startBalance: number;
  endBalance: number;
  change: number;
  percentChange: number | null;
};

/** Период для UI переключателя (месяцы назад). */
export type HistoryPeriodMonths = 3 | 6 | 12 | "all";
