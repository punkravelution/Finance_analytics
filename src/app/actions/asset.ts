"use server";

import { prisma } from "@/lib/prisma";
import { updateMoexPrices as updateMoexPricesLib, type MoexUpdateResult } from "@/lib/fetchMoexPrices";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
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

export interface UpdateSteamPricesResult {
  updated: number;
  failed: number;
}

export type UpdateMoexPricesResult = MoexUpdateResult;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMoexPriceByTicker(ticker: string): Promise<number | null> {
  const code = ticker.trim().toUpperCase();
  if (!code) return null;

  const marketUrl =
    `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${code}.json` +
    "?iss.meta=off&iss.only=marketdata&marketdata.columns=SECID,LAST";
  const marketRes = await fetch(marketUrl, { cache: "no-store" });
  if (!marketRes.ok) return null;
  const marketJson = (await marketRes.json()) as {
    marketdata?: { data?: Array<[string, number | null]> };
  };
  const last = marketJson.marketdata?.data?.[0]?.[1] ?? null;
  if (last != null && Number.isFinite(last) && last > 0) return last;

  const prevUrl =
    `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${code}.json` +
    "?iss.meta=off&iss.only=securities&securities.columns=SECID,PREVPRICE";
  const prevRes = await fetch(prevUrl, { cache: "no-store" });
  if (!prevRes.ok) return null;
  const prevJson = (await prevRes.json()) as {
    securities?: { data?: Array<[string, number | null]> };
  };
  const prev = prevJson.securities?.data?.[0]?.[1] ?? null;
  if (prev != null && Number.isFinite(prev) && prev > 0) return prev;

  return null;
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
    coinGeckoId: formData.get("coinGeckoId")?.toString().trim() || null,
    steamMarketHashName: formData.get("steamMarketHashName")?.toString() || null,
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

  if (data.assetType === "stock" && data.ticker && data.currentUnitPrice == null) {
    try {
      const moexPrice = await fetchMoexPriceByTicker(data.ticker);
      if (moexPrice != null) {
        data.currentUnitPrice = moexPrice;
        data.currentTotalValue = moexPrice * data.quantity;
        data.currency = "RUB";
        data.lastUpdatedAt = new Date();
      }
    } catch {
      // Если MOEX временно недоступен, не блокируем создание актива.
    }
  }

  try {
    await prisma.asset.create({ data });
  } catch (error) {
    console.error("[createAsset] failed:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Ошибка сохранения. Попробуйте ещё раз.";
    return { errors: { general: message } };
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
  } catch (error) {
    console.error("[updateAsset] failed:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Ошибка сохранения. Попробуйте ещё раз.";
    return { errors: { general: message } };
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

export async function updateSteamPrices(
  _prev?: UpdateSteamPricesResult
): Promise<UpdateSteamPricesResult> {
  void _prev;
  const requestHeaders = await headers();
  const hostHeader = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protoHeader = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = hostHeader?.split(",")[0]?.trim();
  const protocol = protoHeader.split(",")[0]?.trim() || "http";

  const assets = await prisma.asset.findMany({
    where: {
      isActive: true,
      steamMarketHashName: { not: null },
    },
    select: { id: true, steamMarketHashName: true, quantity: true },
    orderBy: { name: "asc" },
  });

  let updated = 0;
  let failed = 0;

  for (const asset of assets) {
    const hashName = asset.steamMarketHashName;
    if (!hashName) continue;

    try {
      const endpoint = host
        ? `${protocol}://${host}/api/steam-price?hash_name=${encodeURIComponent(hashName)}`
        : `https://steamcommunity.com/market/priceoverview/?appid=730&currency=5&market_hash_name=${encodeURIComponent(hashName)}`;

      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error("Steam price request failed");

      let price: number | null = null;
      if (host) {
        const json = (await response.json()) as { price: number | null };
        price = json.price;
      } else {
        const json = (await response.json()) as {
          lowest_price?: string;
          median_price?: string;
        };
        const raw = (json.lowest_price ?? json.median_price ?? "")
          .replace(/\s/g, "")
          .replace(/[^\d,.-]/g, "")
          .replace(",", ".");
        const parsed = Number(raw);
        price = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      }

      if (price == null || !Number.isFinite(price) || price <= 0) throw new Error("Price missing");

      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          currentUnitPrice: price,
          currentTotalValue: price * asset.quantity,
          currency: "RUB",
          lastUpdatedAt: new Date(),
        },
      });
      updated += 1;
    } catch {
      failed += 1;
    }

    await sleep(3000);
  }

  revalidatePath("/assets");
  revalidatePath("/");
  revalidatePath("/vaults");

  return { updated, failed };
}

export async function updateMoexPrices(
  _prev?: UpdateMoexPricesResult
): Promise<UpdateMoexPricesResult> {
  void _prev;
  const requestHeaders = await headers();
  const hostHeader = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protoHeader = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = hostHeader?.split(",")[0]?.trim();
  const protocol = protoHeader.split(",")[0]?.trim() || "http";

  if (!host) {
    return { updated: 0, failed: 0, errors: ["Не удалось определить адрес сервера"] };
  }

  const result = await updateMoexPricesLib(`${protocol}://${host}`);
  revalidatePath("/assets");
  revalidatePath("/");
  return result;
}
