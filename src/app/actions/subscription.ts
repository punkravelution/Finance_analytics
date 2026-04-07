"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface SubscriptionActionState {
  errors?: {
    name?: string;
    amount?: string;
    currency?: string;
    billingPeriod?: string;
    nextChargeDate?: string;
    category?: string;
    vaultId?: string;
    general?: string;
  };
}

function parseSubscriptionFormData(formData: FormData) {
  const amountStr = formData.get("amount")?.toString() ?? "";
  const dateStr = formData.get("nextChargeDate")?.toString() ?? "";
  return {
    name: formData.get("name")?.toString().trim() ?? "",
    amount: parseFloat(amountStr),
    currency: formData.get("currency")?.toString().trim().toUpperCase() ?? "",
    billingPeriod: formData.get("billingPeriod")?.toString() ?? "",
    nextChargeDate: dateStr ? new Date(dateStr) : null,
    category: formData.get("category")?.toString().trim() ?? "",
    vaultId: formData.get("vaultId")?.toString() ?? "",
    isEssential: formData.get("isEssential") === "on",
    note: formData.get("note")?.toString().trim() || null,
  };
}

async function validateSubscriptionData(
  data: ReturnType<typeof parseSubscriptionFormData>
) {
  const errors: NonNullable<SubscriptionActionState["errors"]> = {};
  if (!data.name) errors.name = "Укажите название";
  if (isNaN(data.amount) || data.amount <= 0) errors.amount = "Укажите сумму больше 0";
  if (!data.currency) errors.currency = "Выберите валюту";
  if (!["monthly", "quarterly", "yearly"].includes(data.billingPeriod)) {
    errors.billingPeriod = "Выберите период";
  }
  if (!data.nextChargeDate) errors.nextChargeDate = "Укажите дату следующего списания";
  if (!data.category) errors.category = "Укажите категорию";
  if (!data.vaultId) errors.vaultId = "Выберите хранилище";

  if (data.currency) {
    const c = await prisma.currency.findUnique({
      where: { code: data.currency },
      select: { code: true, isActive: true },
    });
    if (!c || !c.isActive) errors.currency = "Выберите активную валюту из справочника";
  }

  return errors;
}

export async function createSubscription(
  _prev: SubscriptionActionState,
  formData: FormData
): Promise<SubscriptionActionState> {
  const data = parseSubscriptionFormData(formData);
  const errors = await validateSubscriptionData(data);
  if (Object.keys(errors).length > 0) return { errors };
  const payload = {
    ...data,
    nextChargeDate: data.nextChargeDate!,
  };

  try {
    await prisma.subscription.create({ data: payload });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath("/subscriptions");
  redirect("/subscriptions");
}

export async function updateSubscription(
  id: string,
  _prev: SubscriptionActionState,
  formData: FormData
): Promise<SubscriptionActionState> {
  const data = parseSubscriptionFormData(formData);
  const errors = await validateSubscriptionData(data);
  if (Object.keys(errors).length > 0) return { errors };
  const payload = {
    ...data,
    nextChargeDate: data.nextChargeDate!,
  };

  try {
    await prisma.subscription.update({ where: { id }, data: payload });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath("/subscriptions");
  redirect("/subscriptions");
}

export async function disableSubscription(id: string): Promise<void> {
  await prisma.subscription.update({
    where: { id },
    data: { isActive: false },
  });
  revalidatePath("/subscriptions");
  redirect("/subscriptions");
}

export async function deleteSubscription(id: string): Promise<void> {
  await prisma.subscription.delete({ where: { id } });
  revalidatePath("/subscriptions");
  redirect("/subscriptions");
}
