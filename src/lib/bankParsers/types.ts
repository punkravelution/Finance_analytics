export interface ParsedTransaction {
  date: Date;
  /** Положительное = доход, отрицательное = расход */
  amount: number;
  currency: string;
  description: string;
  category: string;
  rawCategory: string;
  type: "income" | "expense" | "transfer";
  /** true для типа transfer — пользователь должен выбрать доход/расход/между своими счетами */
  needsClassification: boolean;
  bankSource: "sberbank" | "tbank";
}
