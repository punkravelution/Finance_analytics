export interface ParsedTransaction {
  date: Date;
  /** Положительное = доход, отрицательное = расход */
  amount: number;
  currency: string;
  description: string;
  category: string;
  rawCategory: string;
  type: "income" | "expense" | "transfer";
  bankSource: "sberbank" | "tbank";
}
