"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface IncomeEventActionState {
  errors?: {
    date?: string;
    amount?: string;
    incomeType?: string;
    general?: string;
  };
  success?: boolean;
}

export async function createIncomeEvent(
  assetId: string,
  vaultId: string,
  _prev: IncomeEventActionState,
  formData: FormData
): Promise<IncomeEventActionState> {
  const dateStr = formData.get("date")?.toString() ?? "";
  const amountStr = formData.get("amount")?.toString() ?? "";
  const incomeType = formData.get("incomeType")?.toString() ?? "";
  const currency = formData.get("currency")?.toString().trim() || "RUB";
  const noteRaw = formData.get("note")?.toString().trim() || null;

  const errors: NonNullable<IncomeEventActionState["errors"]> = {};
  if (!dateStr) errors.date = "Укажите дату";
  const amount = parseFloat(amountStr);
  if (!amountStr || isNaN(amount) || amount <= 0)
    errors.amount = "Укажите сумму больше нуля";
  if (!incomeType) errors.incomeType = "Выберите тип дохода";

  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.incomeEvent.create({
      data: {
        assetId,
        vaultId,
        date: new Date(dateStr),
        amount,
        currency,
        incomeType,
        note: noteRaw,
      },
    });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath(`/assets/${assetId}`);
  return { success: true };
}

export async function deleteIncomeEvent(
  assetId: string,
  eventId: string
): Promise<void> {
  await prisma.incomeEvent.delete({ where: { id: eventId } });
  revalidatePath(`/assets/${assetId}`);
}
