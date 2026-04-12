"use server";

import { prisma } from "@/lib/prisma";
import {
  mergeLiabilityLinkTag,
  mergePlannedExpenseLinkTag,
  mergeRecurringIncomeLinkTag,
  mergeSubscriptionLinkTag,
  stringifyTagsForDb,
  stripLiabilityLinkTag,
  stripPlannedExpenseLinkTag,
  stripRecurringIncomeLinkTag,
  stripSubscriptionLinkTag,
} from "@/lib/transactionTags";
import { applyLiabilityPayment, revertLiabilityPayment } from "@/lib/liabilityBalance";
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

function parseTagsField(raw: string | undefined): string | null {
  if (raw == null || !raw.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return null;
    const arr = v
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return stringifyTagsForDb(arr);
  } catch {
    return null;
  }
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
    tags: parseTagsField(formData.get("tags")?.toString()),
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

export async function updateTransactionNote(id: string, note: string): Promise<void> {
  const trimmed = note.trim();
  await prisma.transaction.update({
    where: { id },
    data: { note: trimmed.length > 0 ? trimmed : null },
  });
  revalidatePath("/transactions");
}

export async function updateTransactionCategory(id: string, categoryId: string): Promise<void> {
  const cid = categoryId.trim();
  const row = await prisma.transaction.findUnique({
    where: { id },
    select: { note: true },
  });
  await prisma.transaction.update({
    where: { id },
    data: { categoryId: cid.length > 0 ? cid : null },
  });
  if (cid.length > 0 && row?.note && row.note.trim().length > 5) {
    const pattern = row.note.trim().substring(0, 30).toUpperCase();
    await prisma.categoryRule.upsert({
      where: { pattern },
      update: {
        categoryId: cid,
        matchCount: { increment: 1 },
        source: "learned",
      },
      create: {
        pattern,
        categoryId: cid,
        source: "learned",
        priority: 1,
        isActive: true,
      },
    });
  }
  revalidatePath("/transactions");
  revalidatePath("/settings/rules");
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
          tags: data.tags,
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
          tags: data.tags,
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

export type LinkTransactionResult = { ok: true } | { ok: false; error: string };

/** Если к запланированному платежу не привязано ни одной операции — снимаем isPaid. */
async function syncPlannedExpensePaidFromLinkCount(plannedExpenseId: string | null | undefined): Promise<void> {
  if (!plannedExpenseId) return;
  const n = await prisma.transaction.count({ where: { plannedExpenseId } });
  if (n === 0) {
    await prisma.plannedExpense.update({
      where: { id: plannedExpenseId },
      data: { isPaid: false },
    });
  }
}

export async function linkTransactionToRecurring(
  transactionId: string,
  recurringIncomeId: string
): Promise<LinkTransactionResult> {
  try {
    const [txRow, inc] = await Promise.all([
      prisma.transaction.findUnique({ where: { id: transactionId } }),
      prisma.recurringIncome.findUnique({ where: { id: recurringIncomeId } }),
    ]);
    if (!txRow) return { ok: false, error: "Операция не найдена." };
    if (txRow.type !== "income" || !txRow.toVaultId) {
      return { ok: false, error: "Можно привязать только доход к регулярному поступлению." };
    }
    if (!inc || !inc.isActive) return { ok: false, error: "Регулярный доход не найден или неактивен." };
    if (txRow.toVaultId !== inc.vaultId) {
      return { ok: false, error: "Хранилище операции должно совпадать с хранилищем дохода." };
    }
    const prevPlanned = txRow.plannedExpenseId;
    if (txRow.liabilityId) {
      await revertLiabilityPayment(prisma, txRow.liabilityId, txRow.amount, txRow.currency);
    }
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        recurringIncomeId,
        subscriptionId: null,
        plannedExpenseId: null,
        liabilityId: null,
        tags: mergeRecurringIncomeLinkTag(
          stripLiabilityLinkTag(stripPlannedExpenseLinkTag(stripSubscriptionLinkTag(txRow.tags)))
        ),
      },
    });
    await syncPlannedExpensePaidFromLinkCount(prevPlanned);
    revalidatePath("/transactions");
    revalidatePath("/goals");
    revalidatePath("/liabilities");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка сохранения." };
  }
}

export async function linkTransactionToSubscription(
  transactionId: string,
  subscriptionId: string
): Promise<LinkTransactionResult> {
  try {
    const [txRow, sub] = await Promise.all([
      prisma.transaction.findUnique({ where: { id: transactionId } }),
      prisma.subscription.findUnique({ where: { id: subscriptionId } }),
    ]);
    if (!txRow) return { ok: false, error: "Операция не найдена." };
    if (txRow.type !== "expense" || !txRow.fromVaultId) {
      return { ok: false, error: "Можно привязать только расход к подписке." };
    }
    if (!sub || !sub.isActive) return { ok: false, error: "Подписка не найдена или неактивна." };
    if (txRow.fromVaultId !== sub.vaultId) {
      return { ok: false, error: "Хранилище операции должно совпадать с хранилищем подписки." };
    }
    const prevPlanned = txRow.plannedExpenseId;
    if (txRow.liabilityId) {
      await revertLiabilityPayment(prisma, txRow.liabilityId, txRow.amount, txRow.currency);
    }
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        subscriptionId,
        recurringIncomeId: null,
        plannedExpenseId: null,
        liabilityId: null,
        tags: mergeSubscriptionLinkTag(
          stripLiabilityLinkTag(stripPlannedExpenseLinkTag(txRow.tags))
        ),
      },
    });
    await syncPlannedExpensePaidFromLinkCount(prevPlanned);
    revalidatePath("/transactions");
    revalidatePath("/goals");
    revalidatePath("/liabilities");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка сохранения." };
  }
}

export async function linkTransactionToPlanned(
  transactionId: string,
  plannedExpenseId: string
): Promise<LinkTransactionResult> {
  try {
    const [txRow, planned] = await Promise.all([
      prisma.transaction.findUnique({ where: { id: transactionId } }),
      prisma.plannedExpense.findUnique({ where: { id: plannedExpenseId } }),
    ]);
    if (!txRow) return { ok: false, error: "Операция не найдена." };
    if (txRow.type !== "expense" || !txRow.fromVaultId) {
      return { ok: false, error: "Можно привязать только расход к запланированному платежу." };
    }
    if (!planned) return { ok: false, error: "Запланированный платёж не найден." };
    if (planned.vaultId != null && planned.vaultId !== txRow.fromVaultId) {
      return { ok: false, error: "Хранилище операции должно совпадать с хранилищем плана." };
    }

    const prevPlanned = txRow.plannedExpenseId;

    await prisma.$transaction(async (db) => {
      if (txRow.liabilityId) {
        await revertLiabilityPayment(db, txRow.liabilityId, txRow.amount, txRow.currency);
      }
      await db.transaction.update({
        where: { id: transactionId },
        data: {
          plannedExpenseId,
          subscriptionId: null,
          recurringIncomeId: null,
          liabilityId: null,
          tags: mergePlannedExpenseLinkTag(
            stripLiabilityLinkTag(stripSubscriptionLinkTag(txRow.tags))
          ),
        },
      });
      await db.plannedExpense.update({
        where: { id: plannedExpenseId },
        data: { isPaid: true },
      });
      if (prevPlanned && prevPlanned !== plannedExpenseId) {
        const leftOnPrev = await db.transaction.count({ where: { plannedExpenseId: prevPlanned } });
        if (leftOnPrev === 0) {
          await db.plannedExpense.update({
            where: { id: prevPlanned },
            data: { isPaid: false },
          });
        }
      }
    });

    revalidatePath("/transactions");
    revalidatePath("/goals");
    revalidatePath("/liabilities");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка сохранения." };
  }
}

export async function linkTransactionToLiability(
  transactionId: string,
  liabilityId: string
): Promise<LinkTransactionResult> {
  try {
    const [txRow, liab] = await Promise.all([
      prisma.transaction.findUnique({ where: { id: transactionId } }),
      prisma.liability.findUnique({ where: { id: liabilityId } }),
    ]);
    if (!txRow) return { ok: false, error: "Операция не найдена." };
    if (txRow.type !== "expense" || !txRow.fromVaultId) {
      return { ok: false, error: "Можно привязать только расход к долгу." };
    }
    if (!liab || !liab.isActive) return { ok: false, error: "Обязательство не найдено или неактивно." };
    if (liab.currency.trim().toUpperCase() !== txRow.currency.trim().toUpperCase()) {
      return { ok: false, error: "Валюта операции должна совпадать с валютой долга." };
    }

    const prevL = txRow.liabilityId;

    await prisma.$transaction(async (db) => {
      if (prevL && prevL !== liabilityId) {
        await revertLiabilityPayment(db, prevL, txRow.amount, txRow.currency);
      }
      await db.transaction.update({
        where: { id: transactionId },
        data: {
          liabilityId,
          subscriptionId: null,
          plannedExpenseId: null,
          recurringIncomeId: null,
          tags: mergeLiabilityLinkTag(
            stripPlannedExpenseLinkTag(stripSubscriptionLinkTag(txRow.tags))
          ),
        },
      });
      if (!prevL || prevL !== liabilityId) {
        await applyLiabilityPayment(db, liabilityId, txRow.amount, txRow.currency);
      }
    });

    revalidatePath("/transactions");
    revalidatePath("/liabilities");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка сохранения." };
  }
}

export async function unlinkTransaction(id: string): Promise<LinkTransactionResult> {
  try {
    const row = await prisma.transaction.findUnique({ where: { id } });
    if (!row) return { ok: false, error: "Операция не найдена." };
    const prevPlanned = row.plannedExpenseId;
    const prevLiability = row.liabilityId;
    let tags = row.tags;
    tags = stripSubscriptionLinkTag(tags);
    tags = stripRecurringIncomeLinkTag(tags);
    tags = stripPlannedExpenseLinkTag(tags);
    tags = stripLiabilityLinkTag(tags);
    if (prevLiability) {
      await revertLiabilityPayment(prisma, prevLiability, row.amount, row.currency);
    }
    await prisma.transaction.update({
      where: { id },
      data: {
        recurringIncomeId: null,
        subscriptionId: null,
        plannedExpenseId: null,
        liabilityId: null,
        tags,
      },
    });
    await syncPlannedExpensePaidFromLinkCount(prevPlanned);
    revalidatePath("/transactions");
    revalidatePath("/goals");
    revalidatePath("/liabilities");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка сохранения." };
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  let plannedIdToSync: string | null = null;
  await prisma.$transaction(async (tx) => {
    const old = await tx.transaction.findUnique({ where: { id } });
    if (old) {
      plannedIdToSync = old.plannedExpenseId ?? null;
      if (old.liabilityId) {
        await revertLiabilityPayment(tx, old.liabilityId, old.amount, old.currency);
      }
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
    if (plannedIdToSync) {
      const left = await tx.transaction.count({ where: { plannedExpenseId: plannedIdToSync } });
      if (left === 0) {
        await tx.plannedExpense.update({
          where: { id: plannedIdToSync },
          data: { isPaid: false },
        });
      }
    }
  });

  revalidatePath("/transactions");
  revalidatePath("/vaults");
  revalidatePath("/");
  revalidatePath("/goals");
  revalidatePath("/liabilities");
  redirect("/transactions");
}
