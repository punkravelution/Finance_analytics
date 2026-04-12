"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type ClassifierFormState = {
  error?: string;
  success?: boolean;
};

const CATEGORY_TYPES = new Set(["income", "expense", "transfer"]);

function revalidateClassifierPaths() {
  revalidatePath("/transactions");
  revalidatePath("/transactions/new");
  revalidatePath("/settings/categories-tags");
  revalidatePath("/settings");
  revalidatePath("/analytics");
}

export async function createCategoryAction(
  _prev: ClassifierFormState,
  formData: FormData
): Promise<ClassifierFormState> {
  const name = formData.get("name")?.toString().trim() ?? "";
  const type = formData.get("type")?.toString().trim() ?? "";
  const colorRaw = formData.get("color")?.toString().trim() ?? "";
  const iconRaw = formData.get("icon")?.toString().trim() ?? "";

  if (!name) return { error: "Введите название категории" };
  if (name.length > 80) return { error: "Название не длиннее 80 символов" };
  if (!CATEGORY_TYPES.has(type)) return { error: "Выберите тип: доход, расход или перевод" };

  let color: string | null = null;
  if (colorRaw.length > 0) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(colorRaw)) {
      return { error: "Цвет укажите в формате #RRGGBB или оставьте пустым" };
    }
    color = colorRaw;
  }

  const icon = iconRaw.length > 0 ? iconRaw.slice(0, 8) : null;

  try {
    await prisma.category.create({
      data: { name, type, color, icon },
    });
    revalidateClassifierPaths();
    return { success: true };
  } catch {
    return { error: "Не удалось создать категорию (возможно, такое имя уже есть)" };
  }
}

export async function deleteCategory(id: string): Promise<{ error?: string }> {
  if (!id?.trim()) return { error: "Некорректный идентификатор" };
  const n = await prisma.transaction.count({ where: { categoryId: id } });
  if (n > 0) {
    return { error: `Категория используется в ${n} операциях — удаление недоступно` };
  }
  try {
    await prisma.category.delete({ where: { id } });
    revalidateClassifierPaths();
    return {};
  } catch {
    return { error: "Не удалось удалить категорию" };
  }
}
