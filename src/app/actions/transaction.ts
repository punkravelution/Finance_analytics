"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface TransactionActionState {
  errors?: {
    type?: string;
    amount?: string;
    date?: string;
    fromVaultId?: string;
    toVaultId?: string;
    general?: string;
  };
}

function parseTransactionFormData(formData: FormData) {
  const amountStr = formData.get("amount")?.toString() ?? "";
  const dateStr = formData.get("date")?.toString() ?? "";

  return {
    type: formData.get("type")?.toString() ?? "",
    amount: parseFloat(amountStr),
    date: dateStr ? new Date(dateStr) : null,
    fromVaultId: formData.get("fromVaultId")?.toString() || null,
    toVaultId: formData.get("toVaultId")?.toString() || null,
    categoryId: formData.get("categoryId")?.toString() || null,
    note: formData.get("note")?.toString().trim() || null,
    currency: formData.get("currency")?.toString().trim() || "RUB",
  };
}

function validateTransactionData(data: ReturnType<typeof parseTransactionFormData>) {
  const errors: NonNullable<TransactionActionState["errors"]> = {};

  if (!data.type) errors.type = "Выберите тип";
  if (isNaN(data.amount) || data.amount <= 0)
    errors.amount = "Укажите сумму больше 0";
  if (!data.date) errors.date = "Укажите дату";

  if (data.type === "expense" && !data.fromVaultId)
    errors.fromVaultId = "Укажите хранилище списания";
  if (data.type === "income" && !data.toVaultId)
    errors.toVaultId = "Укажите хранилище зачисления";
  if (data.type === "transfer") {
    if (!data.fromVaultId) errors.fromVaultId = "Укажите хранилище отправителя";
    if (!data.toVaultId) errors.toVaultId = "Укажите хранилище получателя";
    if (
      data.fromVaultId &&
      data.toVaultId &&
      data.fromVaultId === data.toVaultId
    ) {
      errors.toVaultId = "Нельзя переводить в то же хранилище";
    }
  }

  return errors;
}

export async function createTransaction(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const data = parseTransactionFormData(formData);
  const errors = validateTransactionData(data);
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.transaction.create({
      data: {
        type: data.type,
        amount: data.amount,
        date: data.date!,
        fromVaultId: data.fromVaultId,
        toVaultId: data.toVaultId,
        categoryId: data.categoryId,
        note: data.note,
        currency: data.currency,
      },
    });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath("/transactions");
  redirect("/transactions");
}

export async function updateTransaction(
  id: string,
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const data = parseTransactionFormData(formData);
  const errors = validateTransactionData(data);
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.transaction.update({
      where: { id },
      data: {
        type: data.type,
        amount: data.amount,
        date: data.date!,
        fromVaultId: data.fromVaultId,
        toVaultId: data.toVaultId,
        categoryId: data.categoryId,
        note: data.note,
        currency: data.currency,
      },
    });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath("/transactions");
  redirect("/transactions");
}

export async function deleteTransaction(id: string): Promise<void> {
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/transactions");
  redirect("/transactions");
}
