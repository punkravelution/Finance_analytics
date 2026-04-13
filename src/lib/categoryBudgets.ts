import { prisma } from "@/lib/prisma";

export const CATEGORY_BUDGETS_KEY = "categoryBudgets.monthlyLimits";

export type CategoryBudgetMap = Record<string, number>;

export function parseCategoryBudgetMap(raw: string | null | undefined): CategoryBudgetMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: CategoryBudgetMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
      out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export async function getCategoryBudgetMap(): Promise<CategoryBudgetMap> {
  const row = await prisma.appSettings.findUnique({
    where: { key: CATEGORY_BUDGETS_KEY },
    select: { value: true },
  });
  return parseCategoryBudgetMap(row?.value);
}

export async function saveCategoryBudgetMap(map: CategoryBudgetMap): Promise<void> {
  await prisma.appSettings.upsert({
    where: { key: CATEGORY_BUDGETS_KEY },
    update: { value: JSON.stringify(map) },
    create: { key: CATEGORY_BUDGETS_KEY, value: JSON.stringify(map) },
  });
}

