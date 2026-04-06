// ─── Vault ────────────────────────────────────────────────────────────────────

export type VaultType =
  | "bank"
  | "cash"
  | "crypto"
  | "investment"
  | "deposit"
  | "steam"
  | "property"
  | "other";

export type LiquidityLevel = "high" | "medium" | "low" | "illiquid";
export type RiskLevel = "none" | "low" | "medium" | "high" | "extreme";
export type ValuationMode = "manual" | "auto" | "formula";

export const VAULT_TYPE_LABELS: Record<VaultType, string> = {
  bank: "Банк",
  cash: "Наличные",
  crypto: "Крипта",
  investment: "Инвестиции",
  deposit: "Вклад",
  steam: "Steam",
  property: "Имущество",
  other: "Другое",
};

export const LIQUIDITY_LABELS: Record<LiquidityLevel, string> = {
  high: "Высокая",
  medium: "Средняя",
  low: "Низкая",
  illiquid: "Неликвид",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  none: "Нет",
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  extreme: "Экстремальный",
};

// ─── Asset ────────────────────────────────────────────────────────────────────

export type AssetType =
  | "stock"
  | "crypto"
  | "bond"
  | "etf"
  | "commodity"
  | "real_estate"
  | "item"
  | "other";

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: "Акция",
  crypto: "Криптовалюта",
  bond: "Облигация",
  etf: "ETF",
  commodity: "Товар",
  real_estate: "Недвижимость",
  item: "Предмет",
  other: "Другое",
};

// ─── Transaction ──────────────────────────────────────────────────────────────

export type TransactionType = "income" | "expense" | "transfer";

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: "Доход",
  expense: "Расход",
  transfer: "Перевод",
};

// ─── IncomeEvent ──────────────────────────────────────────────────────────────

export type IncomeEventType =
  | "dividend"
  | "coupon"
  | "staking"
  | "rental"
  | "other";

export const INCOME_EVENT_TYPE_LABELS: Record<IncomeEventType, string> = {
  dividend: "Дивиденд",
  coupon: "Купон",
  staking: "Стейкинг",
  rental: "Аренда",
  other: "Другое",
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalNetWorth: number;
  liquidCash: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  totalInvestments: number;
  totalDebts: number;
  netWorthChange: number;
  netWorthChangePercent: number;
  currency: string;
}

export interface VaultSummary {
  id: string;
  name: string;
  type: VaultType;
  currency: string;
  balance: number;
  liquidityLevel: LiquidityLevel;
  riskLevel: RiskLevel;
  color?: string | null;
  icon?: string | null;
  assetsCount: number;
}
