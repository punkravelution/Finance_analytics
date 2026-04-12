"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ClassifierFormState } from "@/app/actions/category";

function revalidateTagPresetPaths() {
  revalidatePath("/transactions");
  revalidatePath("/transactions/new");
  revalidatePath("/settings/categories-tags");
  revalidatePath("/settings");
}

export async function createTagPresetAction(
  _prev: ClassifierFormState,
  formData: FormData
): Promise<ClassifierFormState> {
  const name = formData.get("name")?.toString().trim() ?? "";
  if (!name) return { error: "Введите название тега" };
  if (name.length > 64) return { error: "Тег не длиннее 64 символов" };

  const dup = await prisma.tagPreset.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (dup) return { error: "Такой тег уже есть в справочнике" };

  try {
    await prisma.tagPreset.create({ data: { name } });
    revalidateTagPresetPaths();
    return { success: true };
  } catch {
    return { error: "Не удалось сохранить тег" };
  }
}

export async function deleteTagPreset(id: string): Promise<{ error?: string }> {
  if (!id?.trim()) return { error: "Некорректный идентификатор" };
  try {
    await prisma.tagPreset.delete({ where: { id } });
    revalidateTagPresetPaths();
    return {};
  } catch {
    return { error: "Не удалось удалить тег" };
  }
}
