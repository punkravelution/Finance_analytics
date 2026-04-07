"use server";

import { setBaseCurrency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface SettingsActionState {
  success?: boolean;
  error?: string;
}

export async function updateBaseCurrencyAction(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const currency = formData.get("baseCurrency")?.toString().trim().toUpperCase();

  if (!currency || currency.length !== 3) {
    return { error: "Укажите корректный код валюты (3 символа, например RUB)" };
  }

  const exists = await prisma.currency.findUnique({
    where: { code: currency },
    select: { code: true, isActive: true },
  });
  if (!exists || !exists.isActive) {
    return { error: "Выберите активную валюту из справочника" };
  }

  try {
    await setBaseCurrency(currency);
    revalidatePath("/");
    revalidatePath("/analytics");
    revalidatePath("/settings");
    return { success: true };
  } catch {
    return { error: "Не удалось сохранить настройку" };
  }
}
