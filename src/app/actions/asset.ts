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
    currency: formData.get("currency")?.toString().trim() || "RUB",
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

export async function createAsset(
  _prev: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const data = parseAssetFormData(formData);
  const errors = validateAssetData(data);
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
