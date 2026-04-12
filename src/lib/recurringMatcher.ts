import type {
  Liability,
  PlannedExpense,
  RecurringIncome,
  Subscription,
} from "@/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IncomeMatchTx {
  type: string;
  amount: number;
  date: Date;
  note: string;
  toVaultId: string | null;
}

export interface SubscriptionMatchTx {
  type: string;
  amount: number;
  date: Date;
  note: string;
  fromVaultId: string | null;
}

export interface PlannedExpenseMatchTx {
  type: string;
  amount: number;
  date: Date;
  note: string;
  currency: string;
  fromVaultId: string | null;
}

function amountWithinPercent(actual: number, expected: number, pct: number): boolean {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected <= 0) return false;
  const low = expected * (1 - pct / 100);
  const high = expected * (1 + pct / 100);
  return actual >= low && actual <= high;
}

function daysApart(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

function nameKeywordsInNote(name: string, note: string): boolean {
  const n = note.trim().toLowerCase();
  const raw = name.trim();
  if (raw.length < 2) return true;
  if (n.includes(raw.toLowerCase())) return true;
  const tokens = raw.split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return true;
  return tokens.some((t) => n.includes(t.toLowerCase()));
}

/**
 * Сопоставление дохода с регулярным поступлением. Возвращает null при низкой уверенности.
 */
export function matchRecurringIncome(
  transaction: IncomeMatchTx,
  incomes: RecurringIncome[]
): RecurringIncome | null {
  if (transaction.type !== "income" || !transaction.toVaultId) return null;

  const candidates: RecurringIncome[] = [];
  for (const inc of incomes) {
    if (!inc.isActive) continue;
    if (inc.vaultId !== transaction.toVaultId) continue;
    if (!amountWithinPercent(transaction.amount, inc.amount, 15)) continue;
    if (daysApart(transaction.date, inc.nextIncomeDate) > 10) continue;
    if (!nameKeywordsInNote(inc.name, transaction.note)) continue;
    candidates.push(inc);
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  candidates.sort((a, b) => {
    const da = daysApart(transaction.date, a.nextIncomeDate);
    const db = daysApart(transaction.date, b.nextIncomeDate);
    return da - db;
  });
  return candidates[0] ?? null;
}

/**
 * Сопоставление расхода с подпиской. Возвращает null при низкой уверенности.
 */
export function matchSubscription(
  transaction: SubscriptionMatchTx,
  subscriptions: Subscription[]
): Subscription | null {
  if (transaction.type !== "expense" || !transaction.fromVaultId) return null;

  const candidates: Subscription[] = [];
  for (const sub of subscriptions) {
    if (!sub.isActive) continue;
    if (sub.vaultId !== transaction.fromVaultId) continue;
    if (!amountWithinPercent(transaction.amount, sub.amount, 10)) continue;

    const noteLower = transaction.note.trim().toLowerCase();
    const nameLower = sub.name.trim().toLowerCase();
    const dateOk = daysApart(transaction.date, sub.nextChargeDate) <= 5;
    const nameOk = nameLower.length > 0 && noteLower.includes(nameLower);

    if (!dateOk && !nameOk) continue;
    candidates.push(sub);
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  candidates.sort((a, b) => {
    const da = daysApart(transaction.date, a.nextChargeDate);
    const db = daysApart(transaction.date, b.nextChargeDate);
    return da - db;
  });
  return candidates[0] ?? null;
}

/**
 * Сопоставление расхода с неоплаченным запланированным платежом.
 * Консервативно: при сомнении возвращает null.
 */
export function matchPlannedExpense(
  transaction: PlannedExpenseMatchTx,
  items: PlannedExpense[]
): PlannedExpense | null {
  if (transaction.type !== "expense" || !transaction.fromVaultId) return null;
  const txCur = transaction.currency.trim().toUpperCase() || "RUB";

  const candidates: PlannedExpense[] = [];
  for (const p of items) {
    if (p.isPaid) continue;
    if (p.vaultId != null && p.vaultId !== transaction.fromVaultId) continue;
    if (p.currency.trim().toUpperCase() !== txCur) continue;
    if (!amountWithinPercent(transaction.amount, p.amount, 12)) continue;

    const dateOk =
      p.dueDate != null && daysApart(transaction.date, p.dueDate) <= 7;
    const nameMatch = nameKeywordsInNote(p.name, transaction.note);
    if (p.dueDate == null) {
      if (!nameMatch) continue;
    } else if (!dateOk && !nameMatch) {
      continue;
    }
    candidates.push(p);
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  candidates.sort((a, b) => {
    const da =
      a.dueDate != null ? daysApart(transaction.date, a.dueDate) : Number.POSITIVE_INFINITY;
    const db =
      b.dueDate != null ? daysApart(transaction.date, b.dueDate) : Number.POSITIVE_INFINITY;
    return da - db;
  });
  return candidates[0] ?? null;
}

export interface LiabilityMatchTx {
  type: string;
  amount: number;
  date: Date;
  note: string;
  currency: string;
  fromVaultId: string | null;
}

/**
 * Сопоставление расхода с активным долгом (остаток > 0).
 */
export function matchLiability(
  transaction: LiabilityMatchTx,
  items: Liability[]
): Liability | null {
  if (transaction.type !== "expense" || !transaction.fromVaultId) return null;
  const txCur = transaction.currency.trim().toUpperCase() || "RUB";

  const candidates: Liability[] = [];
  for (const l of items) {
    if (!l.isActive || l.currentBalance <= 0) continue;
    if (l.currency.trim().toUpperCase() !== txCur) continue;

    const minPay = l.minimumPayment != null && l.minimumPayment > 0 ? l.minimumPayment : null;
    const matchesMin =
      minPay != null && amountWithinPercent(transaction.amount, minPay, 12);
    const matchesBalance = amountWithinPercent(transaction.amount, l.currentBalance, 12);

    if (!matchesMin && !matchesBalance) continue;

    const hasNext = l.nextPaymentDate != null;
    const dateOk = hasNext && daysApart(transaction.date, l.nextPaymentDate!) <= 10;
    const nameMatch = nameKeywordsInNote(l.name, transaction.note);
    if (!dateOk && !nameMatch) continue;

    candidates.push(l);
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  candidates.sort((a, b) => {
    const da = a.nextPaymentDate
      ? daysApart(transaction.date, a.nextPaymentDate)
      : Number.POSITIVE_INFINITY;
    const db = b.nextPaymentDate
      ? daysApart(transaction.date, b.nextPaymentDate)
      : Number.POSITIVE_INFINITY;
    return da - db;
  });
  return candidates[0] ?? null;
}
