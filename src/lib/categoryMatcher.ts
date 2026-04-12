import type { Category, CategoryRule } from "@/generated/prisma/client";
import type { ParsedTransaction } from "@/lib/bankParsers/types";
import { BANK_AUTO_CATEGORY_EXCLUSIONS } from "@/lib/defaultCategoryRules";

export type CategoryRuleWithCategory = CategoryRule & { category: Category };

function normalizeDescription(description: string): string {
  return description.trim().toUpperCase();
}

/** Сортировка для сопоставления: выше priority, затем больше matchCount. */
export function sortRulesForMatching(rules: readonly CategoryRuleWithCategory[]): CategoryRuleWithCategory[] {
  return [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/** true — не применять авто-категории (банковские переводы и т.п.). */
export function isDescriptionExcludedFromAutoCategory(description: string): boolean {
  const u = normalizeDescription(description);
  return BANK_AUTO_CATEGORY_EXCLUSIONS.some((frag) => u.includes(frag));
}

/**
 * Первое сработавшее правило (по приоритету и счётчику) или null.
 */
export function matchCategoryRule(
  description: string,
  rules: readonly CategoryRuleWithCategory[]
): CategoryRuleWithCategory | null {
  const desc = normalizeDescription(description);
  if (!desc) return null;
  const sorted = sortRulesForMatching(rules);
  for (const rule of sorted) {
    if (!rule.isActive) continue;
    const pat = rule.pattern.trim().toUpperCase();
    if (!pat) continue;
    if (desc.includes(pat)) return rule;
  }
  return null;
}

/**
 * Возвращает категорию первого подошедшего правила или null.
 */
export function matchCategory(
  description: string,
  rules: readonly CategoryRuleWithCategory[]
): Category | null {
  const hit = matchCategoryRule(description, rules);
  return hit?.category ?? null;
}

/**
 * Проставляет `suggestedCategoryId` по тем же правилам, что и при импорте (без категории из банка).
 */
export function applyCategoryRules(
  transactions: ParsedTransaction[],
  rules: readonly CategoryRuleWithCategory[]
): ParsedTransaction[] {
  const sorted = sortRulesForMatching(rules);
  return transactions.map((t) => {
    if (isDescriptionExcludedFromAutoCategory(t.description)) {
      return { ...t, suggestedCategoryId: null };
    }
    const hit = matchCategoryRule(t.description, sorted);
    return { ...t, suggestedCategoryId: hit ? hit.category.id : null };
  });
}
