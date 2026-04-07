"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface ValuationActionState {
  errors?: {
    date?: string;
    unitPrice?: string;
    general?: string;
  };
  success?: boolean;
}

export async function createValuation(
  assetId: string,
  _prev: ValuationActionState,
  formData: FormData
): Promise<ValuationActionState> {
  const dateStr = formData.get("date")?.toString() ?? "";
  const unitPriceStr = formData.get("unitPrice")?.toString() ?? "";
  const notesRaw = formData.get("notes")?.toString().trim() || null;

  const errors: NonNullable<ValuationActionState["errors"]> = {};
  if (!dateStr) errors.date = "Укажите дату";
  const unitPrice = parseFloat(unitPriceStr);
  if (!unitPriceStr || isNaN(unitPrice) || unitPrice < 0)
    errors.unitPrice = "Укажите корректную цену за единицу";

  if (Object.keys(errors).length > 0) return { errors };

  try {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { quantity: true },
    });
    if (!asset) return { errors: { general: "Актив не найден" } };

    const totalValue = unitPrice * asset.quantity;

    await prisma.$transaction([
      prisma.assetValuation.create({
        data: {
          assetId,
          date: new Date(dateStr),
          unitPrice,
          totalValue,
          source: "manual",
          notes: notesRaw,
        },
      }),
      // Обновляем текущую цену актива последней оценкой
      prisma.asset.update({
        where: { id: assetId },
        data: {
          currentUnitPrice: unitPrice,
          currentTotalValue: totalValue,
          lastUpdatedAt: new Date(),
        },
      }),
    ]);
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath(`/assets/${assetId}`);
  return { success: true };
}

export async function deleteValuation(
  assetId: string,
  valuationId: string
): Promise<void> {
  await prisma.assetValuation.delete({ where: { id: valuationId } });
  revalidatePath(`/assets/${assetId}`);
}
