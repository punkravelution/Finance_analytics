/** Маркер привязки к записи Subscription (см. subscriptionId). */
export const TAG_LINK_SUBSCRIPTION = "подписка";

/** Маркер привязки к записи RecurringIncome (см. recurringIncomeId). */
export const TAG_LINK_RECURRING_INCOME = "регулярный доход";

/** Маркер привязки к записи PlannedExpense (см. plannedExpenseId). */
export const TAG_LINK_PLANNED_EXPENSE = "плановый платёж";

/** Маркер привязки к записи Liability (см. liabilityId). */
export const TAG_LINK_LIABILITY = "долг";

function uniqueOrdered(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const s = t.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Добавляет тег привязки к подписке, если его ещё нет. */
export function mergeSubscriptionLinkTag(raw: string | null | undefined): string | null {
  const base = parseTagsJson(raw);
  if (base.includes(TAG_LINK_SUBSCRIPTION)) {
    return stringifyTagsForDb(base);
  }
  return stringifyTagsForDb(uniqueOrdered([...base, TAG_LINK_SUBSCRIPTION]));
}

/** Добавляет тег привязки к регулярному доходу, если его ещё нет. */
export function mergeRecurringIncomeLinkTag(raw: string | null | undefined): string | null {
  const base = parseTagsJson(raw);
  if (base.includes(TAG_LINK_RECURRING_INCOME)) {
    return stringifyTagsForDb(base);
  }
  return stringifyTagsForDb(uniqueOrdered([...base, TAG_LINK_RECURRING_INCOME]));
}

/** Убирает маркер привязки к подписке (при отвязке). */
export function stripSubscriptionLinkTag(raw: string | null | undefined): string | null {
  const base = parseTagsJson(raw).filter((t) => t !== TAG_LINK_SUBSCRIPTION);
  return stringifyTagsForDb(base);
}

/** Убирает маркер привязки к регулярному доходу (при отвязке). */
export function stripRecurringIncomeLinkTag(raw: string | null | undefined): string | null {
  const base = parseTagsJson(raw).filter((t) => t !== TAG_LINK_RECURRING_INCOME);
  return stringifyTagsForDb(base);
}

/** Добавляет тег привязки к запланированному платежу, если его ещё нет. */
export function mergePlannedExpenseLinkTag(raw: string | null | undefined): string | null {
  const base = parseTagsJson(raw);
  if (base.includes(TAG_LINK_PLANNED_EXPENSE)) {
    return stringifyTagsForDb(base);
  }
  return stringifyTagsForDb(uniqueOrdered([...base, TAG_LINK_PLANNED_EXPENSE]));
}

/** Убирает маркер привязки к запланированному платежу (при отвязке). */
export function stripPlannedExpenseLinkTag(raw: string | null | undefined): string | null {
  const base = parseTagsJson(raw).filter((t) => t !== TAG_LINK_PLANNED_EXPENSE);
  return stringifyTagsForDb(base);
}

/** Добавляет тег привязки к долгу, если его ещё нет. */
export function mergeLiabilityLinkTag(raw: string | null | undefined): string | null {
  const base = parseTagsJson(raw);
  if (base.includes(TAG_LINK_LIABILITY)) {
    return stringifyTagsForDb(base);
  }
  return stringifyTagsForDb(uniqueOrdered([...base, TAG_LINK_LIABILITY]));
}

/** Убирает маркер привязки к долгу (при отвязке). */
export function stripLiabilityLinkTag(raw: string | null | undefined): string | null {
  const base = parseTagsJson(raw).filter((t) => t !== TAG_LINK_LIABILITY);
  return stringifyTagsForDb(base);
}

/** Парсинг поля Transaction.tags (JSON-массив строк). */
export function parseTagsJson(raw: string | null | undefined): string[] {
  if (raw == null || !raw.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

export function stringifyTagsForDb(tags: string[]): string | null {
  const cleaned = tags.map((t) => t.trim()).filter((t) => t.length > 0);
  if (cleaned.length === 0) return null;
  return JSON.stringify(cleaned);
}
