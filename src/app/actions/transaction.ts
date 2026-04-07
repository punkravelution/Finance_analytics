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

/**
 * Применяет изменение баланса к MANUAL-хранилищу внутри транзакции БД.
 * Если vault не MANUAL — пропускает без ошибки.
 */
async function applyBalanceDelta(
  tx: typeof prisma,
  vaultId: string | null,
  delta: number
): Promise<void> {
  if (!vaultId) return;
  const vault = await tx.vault.findUnique({
    where: { id: vaultId },
    select: { balanceSource: true },
  });
  if (vault?.balanceSource === "MANUAL") {
    await tx.vault.update({
      where: { id: vaultId },
      data: { manualBalance: { increment: delta } },
    });
  }
}

/**
 * Проверяет, что vault не является ASSETS-хранилищем.
 * Возвращает строку с ошибкой или null.
 */
async function checkNotAssetsVault(
  vaultId: string | null,
  label: string
): Promise<string | null> {
  if (!vaultId) return null;
  const vault = await prisma.vault.findUnique({
    where: { id: vaultId },
    select: { name: true, balanceSource: true },
  });
  if (vault?.balanceSource === "ASSETS") {
    return `Хранилище «${vault.name}» управляется через активы. Денежные операции для него недоступны. ${label} должно быть хранилищем с ручным балансом.`;
  }
  return null;
}

export async function createTransaction(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const data = parseTransactionFormData(formData);
  const errors = validateTransactionData(data);
  if (Object.keys(errors).length > 0) return { errors };

  // Проверка: запрет операций с ASSETS-хранилищами
  const [fromErr, toErr] = await Promise.all([
    checkNotAssetsVault(data.fromVaultId, "Хранилище списания"),
    checkNotAssetsVault(data.toVaultId, "Хранилище зачисления"),
  ]);
  if (fromErr) return { errors: { fromVaultId: fromErr } };
  if (toErr) return { errors: { toVaultId: toErr } };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
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

      // Применяем изменения баланса
      if (data.type === "income") {
        await applyBalanceDelta(tx as typeof prisma, data.toVaultId, data.amount);
      } else if (data.type === "expense") {
        await applyBalanceDelta(tx as typeof prisma, data.fromVaultId, -data.amount);
      } else if (data.type === "transfer") {
        await applyBalanceDelta(tx as typeof prisma, data.fromVaultId, -data.amount);
        await applyBalanceDelta(tx as typeof prisma, data.toVaultId, data.amount);
      }
    });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath("/transactions");
  revalidatePath("/vaults");
  revalidatePath("/");
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

  // Проверка: запрет операций с ASSETS-хранилищами для новых значений
  const [fromErr, toErr] = await Promise.all([
    checkNotAssetsVault(data.fromVaultId, "Хранилище списания"),
    checkNotAssetsVault(data.toVaultId, "Хранилище зачисления"),
  ]);
  if (fromErr) return { errors: { fromVaultId: fromErr } };
  if (toErr) return { errors: { toVaultId: toErr } };

  try {
    await prisma.$transaction(async (tx) => {
      // Откатываем эффект старой операции
      const old = await tx.transaction.findUnique({ where: { id } });
      if (old) {
        if (old.type === "income") {
          await applyBalanceDelta(tx as typeof prisma, old.toVaultId, -old.amount);
        } else if (old.type === "expense") {
          await applyBalanceDelta(tx as typeof prisma, old.fromVaultId, old.amount);
        } else if (old.type === "transfer") {
          await applyBalanceDelta(tx as typeof prisma, old.fromVaultId, old.amount);
          await applyBalanceDelta(tx as typeof prisma, old.toVaultId, -old.amount);
        }
      }

      // Обновляем запись
      await tx.transaction.update({
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

      // Применяем эффект новой операции
      if (data.type === "income") {
        await applyBalanceDelta(tx as typeof prisma, data.toVaultId, data.amount);
      } else if (data.type === "expense") {
        await applyBalanceDelta(tx as typeof prisma, data.fromVaultId, -data.amount);
      } else if (data.type === "transfer") {
        await applyBalanceDelta(tx as typeof prisma, data.fromVaultId, -data.amount);
        await applyBalanceDelta(tx as typeof prisma, data.toVaultId, data.amount);
      }
    });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath("/transactions");
  revalidatePath("/vaults");
  revalidatePath("/");
  redirect("/transactions");
}

export async function deleteTransaction(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const old = await tx.transaction.findUnique({ where: { id } });
    if (old) {
      // Откатываем эффект операции
      if (old.type === "income") {
        await applyBalanceDelta(tx as typeof prisma, old.toVaultId, -old.amount);
      } else if (old.type === "expense") {
        await applyBalanceDelta(tx as typeof prisma, old.fromVaultId, old.amount);
      } else if (old.type === "transfer") {
        await applyBalanceDelta(tx as typeof prisma, old.fromVaultId, old.amount);
        await applyBalanceDelta(tx as typeof prisma, old.toVaultId, -old.amount);
      }
    }
    await tx.transaction.delete({ where: { id } });
  });

  revalidatePath("/transactions");
  revalidatePath("/vaults");
  revalidatePath("/");
  redirect("/transactions");
}
