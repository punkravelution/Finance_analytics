"use server";

import { revalidatePath } from "next/cache";
import { getCategoryBudgetMap, saveCategoryBudgetMap } from "@/lib/categoryBudgets";

export async function upsertCategoryBudget(categoryId: string, formData: FormData): Promise<void> {
  const raw = formData.get("limit")?.toString().trim() ?? "";
  const nextMap = await getCategoryBudgetMap();
  if (raw.length === 0) {
    delete nextMap[categoryId];
  } else {
    const value = Number.parseFloat(raw);
    if (Number.isFinite(value) && value > 0) {
      nextMap[categoryId] = value;
    } else {
      delete nextMap[categoryId];
    }
  }
  await saveCategoryBudgetMap(nextMap);
  revalidatePath("/settings/categories-tags");
  revalidatePath("/assistant");
  revalidatePath("/settings");
}

