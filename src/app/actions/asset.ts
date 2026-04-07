"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface AssetActionState {
  errors?: {
    name?: string;
    assetType?: string;
    vaultId?: string;
    quantity?: string;
    currency?: string;
    general?: string;
  };
}

export interface SellAssetActionState {
  errors?: {
    amount?: string;
    toVaultId?: string;
    general?: string;
  };
}

function parseAssetFormData(formData: FormData) {
  const quantityStr = formData.get("quantity")?.toString() ?? "";
  const avgBuyStr = formData.get("averageBuyPrice")?.toString() ?? "";
  const curPriceStr = formData.get("currentUnitPrice")?.toString() ?? "";

  const quantity = parseFloat(quantityStr);
  const averageBuyPrice = avgBuyStr ? parseFloat(avgBuyStr) : null;
  const currentUnitPrice = curPriceStr ? parseFloat(curPriceStr) : null;

  return {
    name: formData.get("name")?.toString().trim() ?? "",
    assetType: formData.get("assetType")?.toString() ?? "",
    vaultId: formData.get("vaultId")?.toString() ?? "",
    ticker: formData.get("ticker")?.toString().trim() || null,
    quantity,
    unit: formData.get("unit")?.toString().trim() || "шт",
    averageBuyPrice:
      averageBuyPrice != null && !isNaN(averageBuyPrice) ? averageBuyPrice : null,
    currentUnitPrice:
      currentUnitPrice != null && !isNaN(currentUnitPrice) ? currentUnitPrice : null,
    currentTotalValue:
      currentUnitPrice != null && !isNaN(currentUnitPrice) && !isNaN(quantity)
        ? currentUnitPrice * quantity
        : null,
    currency: formData.get("currency")?.toString().trim().toUpperCase() || "RUB",
    notes: formData.get("notes")?.toString().trim() || null,
    lastUpdatedAt: new Date(),
  };
}

function validateAssetData(data: ReturnType<typeof parseAssetFormData>) {
  const errors: NonNullable<AssetActionState["errors"]> = {};
  if (!data.name) errors.name = "Укажите название";
  if (!data.assetType) errors.assetType = "Выберите тип актива";
  if (!data.vaultId) errors.vaultId = "Выберите хранилище";
  if (isNaN(data.quantity) || data.quantity < 0)
    errors.quantity = "Укажите корректное количество (≥ 0)";
  return errors;
}

async function validateAssetCurrency(
  code: string
): Promise<string | null> {
  const currency = await prisma.currency.findUnique({
    where: { code: code.toUpperCase() },
    select: { code: true, isActive: true },
  });
  if (!currency || !currency.isActive) {
    return "Выберите существующую активную валюту";
  }
  return null;
}

export async function createAsset(
  _prev: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const data = parseAssetFormData(formData);
  const errors = validateAssetData(data);
  const currencyError = await validateAssetCurrency(data.currency);
  if (currencyError) errors.currency = currencyError;
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.asset.create({ data });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath("/assets");
  redirect("/assets");
}

export async function updateAsset(
  id: string,
  _prev: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const data = parseAssetFormData(formData);
  const errors = validateAssetData(data);
  const currencyError = await validateAssetCurrency(data.currency);
  if (currencyError) errors.currency = currencyError;
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.asset.update({ where: { id }, data });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  redirect(`/assets/${id}`);
}

export async function deleteAsset(id: string): Promise<void> {
  await prisma.asset.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/assets");
  redirect("/assets");
}

export async function permanentlyDeleteAsset(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.assetValuation.deleteMany({ where: { assetId: id } });
    await tx.incomeEvent.deleteMany({ where: { assetId: id } });
    await tx.asset.delete({ where: { id } });
  });
  revalidatePath("/assets");
  redirect("/assets");
}

function parseSellAssetFormData(formData: FormData) {
  const amountStr = formData.get("amount")?.toString() ?? "";
  return {
    amount: parseFloat(amountStr),
    toVaultId: formData.get("toVaultId")?.toString() ?? "",
    note: formData.get("note")?.toString().trim() || "",
  };
}

export async function sellAsset(
  id: string,
  _prev: SellAssetActionState,
  formData: FormData
): Promise<SellAssetActionState> {
  const data = parseSellAssetFormData(formData);
  const errors: NonNullable<SellAssetActionState["errors"]> = {};
  if (!data.toVaultId) errors.toVaultId = "Выберите хранилище зачисления";
  if (isNaN(data.amount) || data.amount <= 0) {
    errors.amount = "Укажите сумму продажи больше 0";
  }
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.$transaction(async (tx) => {
      const [asset, targetVault] = await Promise.all([
        tx.asset.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            isActive: true,
            currency: true,
            notes: true,
          },
        }),
        tx.vault.findUnique({
          where: { id: data.toVaultId },
          select: { id: true, name: true, balanceSource: true },
        }),
      ]);

      if (!asset || !asset.isActive) {
        throw new Error("Актив не найден");
      }
      if (!targetVault) {
        throw new Error("Хранилище зачисления не найдено");
      }
      if (targetVault.balanceSource !== "MANUAL") {
        return Promise.reject(
          new Error(
            `Хранилище «${targetVault.name}» управляется через активы. Для продажи выберите денежное хранилище.`
          )
        );
      }

      const saleNoteBase = `Продажа/вывод актива: ${asset.name}`;
      const saleNote = data.note ? `${saleNoteBase}. ${data.note}` : saleNoteBase;
      const nextAssetNote = data.note
        ? `${asset.notes ? `${asset.notes}\n` : ""}Продано: ${data.note}`
        : `${asset.notes ? `${asset.notes}\n` : ""}Продано через вывод из портфеля`;

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          isActive: false,
          quantity: 0,
          currentTotalValue: 0,
          lastUpdatedAt: new Date(),
          notes: nextAssetNote,
        },
      });

      await tx.transaction.create({
        data: {
          type: "income",
          amount: data.amount,
          currency: asset.currency,
          date: new Date(),
          toVaultId: targetVault.id,
          note: saleNote,
        },
      });

      await tx.vault.update({
        where: { id: targetVault.id },
        data: { manualBalance: { increment: data.amount } },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Ошибка продажи актива. Попробуйте ещё раз.";
    return { errors: { general: message } };
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  revalidatePath("/transactions");
  revalidatePath("/vaults");
  revalidatePath("/");
  redirect("/assets");
}
