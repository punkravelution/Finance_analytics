"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Liability } from "@/generated/prisma/client";

export interface LiabilityActionState {
  errors?: {
    name?: string;
    type?: string;
    principalAmount?: string;
    currentBalance?: string;
    currency?: string;
    minimumPayment?: string;
    nextPaymentDate?: string;
    general?: string;
  };
}

function parseLiabilityFormData(formData: FormData) {
  const principalStr = formData.get("principalAmount")?.toString() ?? "";
  const balanceStr = formData.get("currentBalance")?.toString() ?? "";
  const interestStr = formData.get("interestRate")?.toString() ?? "";
  const minimumStr = formData.get("minimumPayment")?.toString() ?? "";
  const nextDateStr = formData.get("nextPaymentDate")?.toString() ?? "";
  return {
    name: formData.get("name")?.toString().trim() ?? "",
    type: formData.get("type")?.toString() ?? "",
    principalAmount: parseFloat(principalStr),
    currentBalance: parseFloat(balanceStr),
    currency: formData.get("currency")?.toString().trim().toUpperCase() ?? "",
    interestRate: interestStr ? parseFloat(interestStr) : null,
    minimumPayment: minimumStr ? parseFloat(minimumStr) : null,
    nextPaymentDate: nextDateStr ? new Date(nextDateStr) : null,
    lender: formData.get("lender")?.toString().trim() || null,
    note: formData.get("note")?.toString().trim() || null,
  };
}

async function validateLiabilityData(
  data: ReturnType<typeof parseLiabilityFormData>
) {
  const errors: NonNullable<LiabilityActionState["errors"]> = {};
  if (!data.name) errors.name = "Укажите название";
  if (!data.type) errors.type = "Выберите тип";
  if (isNaN(data.principalAmount) || data.principalAmount < 0) {
    errors.principalAmount = "Укажите корректную исходную сумму";
  }
  if (isNaN(data.currentBalance) || data.currentBalance < 0) {
    errors.currentBalance = "Укажите корректный остаток";
  }
  if (
    !isNaN(data.principalAmount) &&
    !isNaN(data.currentBalance) &&
    data.currentBalance > data.principalAmount
  ) {
    errors.currentBalance = "Остаток долга не может быть больше исходной суммы";
  }
  if (data.minimumPayment != null && (isNaN(data.minimumPayment) || data.minimumPayment < 0)) {
    errors.minimumPayment = "Минимальный платёж должен быть ≥ 0";
  }
  if (!data.currency) errors.currency = "Выберите валюту";

  if (data.currency) {
    const c = await prisma.currency.findUnique({
      where: { code: data.currency },
      select: { code: true, isActive: true },
    });
    if (!c || !c.isActive) errors.currency = "Выберите активную валюту из справочника";
  }

  return errors;
}

export async function createLiability(
  _prev: LiabilityActionState,
  formData: FormData
): Promise<LiabilityActionState> {
  const data = parseLiabilityFormData(formData);
  const errors = await validateLiabilityData(data);
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.liability.create({ data: data as never });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath("/liabilities");
  revalidatePath("/transactions");
  redirect("/liabilities");
}

export async function updateLiability(
  id: string,
  _prev: LiabilityActionState,
  formData: FormData
): Promise<LiabilityActionState> {
  const data = parseLiabilityFormData(formData);
  const errors = await validateLiabilityData(data);
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.liability.update({ where: { id }, data });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath("/liabilities");
  revalidatePath("/transactions");
  redirect("/liabilities");
}

export async function closeLiability(id: string): Promise<void> {
  await prisma.liability.update({
    where: { id },
    data: { isActive: false, currentBalance: 0 },
  });
  revalidatePath("/liabilities");
  revalidatePath("/transactions");
  redirect("/liabilities");
}

export async function disableLiability(id: string): Promise<void> {
  await prisma.liability.update({
    where: { id },
    data: { isActive: false },
  });
  revalidatePath("/liabilities");
  revalidatePath("/transactions");
  redirect("/liabilities");
}

export type LiabilityHistoryEntry = {
  id: string;
  date: Date;
  amount: number;
  currency: string;
  note: string | null;
  /** Отклонение от минимального платежа (если задан), в процентах */
  deviationFromMinimumPaymentPct: number | null;
};

/** Долг и связанные платежи-расходы за последние 12 месяцев. */
export async function getLiabilityWithHistory(id: string): Promise<{
  liability: Liability;
  entries: LiabilityHistoryEntry[];
} | null> {
  const liability = await prisma.liability.findUnique({ where: { id } });
  if (!liability) return null;
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const txs = await prisma.transaction.findMany({
    where: {
      liabilityId: id,
      date: { gte: since },
    },
    orderBy: { date: "desc" },
    select: { id: true, date: true, amount: true, currency: true, note: true },
  });
  const entries: LiabilityHistoryEntry[] = txs.map((t) => ({
    id: t.id,
    date: t.date,
    amount: t.amount,
    currency: t.currency,
    note: t.note,
    deviationFromMinimumPaymentPct:
      liability.minimumPayment != null &&
      liability.minimumPayment > 0 &&
      Number.isFinite(liability.minimumPayment)
        ? ((t.amount - liability.minimumPayment) / liability.minimumPayment) * 100
        : null,
  }));
  return { liability, entries };
}
