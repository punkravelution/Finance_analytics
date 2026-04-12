"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { seedMissingDefaultCategoryRules } from "@/lib/defaultCategoryRules";
import type { CategoryRuleWithCategory } from "@/lib/categoryMatcher";

export async function getCategoryRules(): Promise<CategoryRuleWithCategory[]> {
  return prisma.categoryRule.findMany({
    include: { category: true },
    orderBy: [{ priority: "desc" }, { matchCount: "desc" }, { createdAt: "asc" }],
  });
}

export type CreateCategoryRuleInput = {
  pattern: string;
  categoryId: string;
  priority?: number;
};

export async function createCategoryRule(data: CreateCategoryRuleInput): Promise<{ error?: string }> {
  const pattern = data.pattern.trim().toUpperCase();
  if (!pattern) return { error: "Укажите паттерн" };
  if (!data.categoryId?.trim()) return { error: "Выберите категорию" };

  const cat = await prisma.category.findUnique({
    where: { id: data.categoryId.trim() },
    select: { id: true },
  });
  if (!cat) return { error: "Категория не найдена" };

  try {
    await prisma.categoryRule.create({
      data: {
        pattern,
        categoryId: cat.id,
        priority: data.priority ?? 0,
        source: "manual",
        isActive: true,
      },
    });
    revalidatePath("/settings/rules");
    revalidatePath("/import");
    return {};
  } catch {
    return { error: "Правило с таким паттерном уже существует" };
  }
}

export type UpdateCategoryRuleInput = {
  pattern?: string;
  categoryId?: string;
  priority?: number;
  isActive?: boolean;
};

export async function updateCategoryRule(
  id: string,
  data: UpdateCategoryRuleInput
): Promise<{ error?: string }> {
  if (!id.trim()) return { error: "Некорректный id" };

  const patch: {
    pattern?: string;
    categoryId?: string;
    priority?: number;
    isActive?: boolean;
  } = {};

  if (data.pattern !== undefined) {
    const p = data.pattern.trim().toUpperCase();
    if (!p) return { error: "Паттерн не может быть пустым" };
    patch.pattern = p;
  }
  if (data.categoryId !== undefined) {
    const cid = data.categoryId.trim();
    const cat = await prisma.category.findUnique({ where: { id: cid }, select: { id: true } });
    if (!cat) return { error: "Категория не найдена" };
    patch.categoryId = cid;
  }
  if (data.priority !== undefined) {
    if (!Number.isFinite(data.priority)) return { error: "Приоритет должен быть числом" };
    patch.priority = Math.trunc(data.priority);
  }
  if (data.isActive !== undefined) patch.isActive = data.isActive;

  if (Object.keys(patch).length === 0) return {};

  try {
    await prisma.categoryRule.update({
      where: { id },
      data: patch,
    });
    revalidatePath("/settings/rules");
    revalidatePath("/import");
    return {};
  } catch {
    return { error: "Не удалось сохранить (возможно, дубликат паттерна)" };
  }
}

export async function deleteCategoryRule(id: string): Promise<{ error?: string }> {
  if (!id.trim()) return { error: "Некорректный id" };
  try {
    await prisma.categoryRule.delete({ where: { id } });
    revalidatePath("/settings/rules");
    revalidatePath("/import");
    return {};
  } catch {
    return { error: "Не удалось удалить правило" };
  }
}

export async function toggleCategoryRule(id: string): Promise<{ error?: string }> {
  const row = await prisma.categoryRule.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!row) return { error: "Правило не найдено" };
  await prisma.categoryRule.update({
    where: { id },
    data: { isActive: !row.isActive },
  });
  revalidatePath("/settings/rules");
  revalidatePath("/import");
  return {};
}

export async function seedDefaultCategoryRulesAction(): Promise<{
  ok: true;
  createdRules: number;
  skippedExisting: number;
} | { ok: false; error: string }> {
  try {
    const r = await seedMissingDefaultCategoryRules(prisma);
    revalidatePath("/settings/rules");
    revalidatePath("/settings/categories-tags");
    revalidatePath("/import");
    revalidatePath("/transactions");
    return { ok: true, ...r };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка загрузки правил";
    return { ok: false, error: msg };
  }
}
