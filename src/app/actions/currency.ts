"use server";

import { prisma } from "@/lib/prisma";
import { updateExchangeRates } from "@/lib/fetchRates";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export interface CurrencyActionState {
  errors?: {
    code?: string;
    name?: string;
    symbol?: string;
    sortOrder?: string;
    rate?: string;
    fromCurrency?: string;
    toCurrency?: string;
    general?: string;
  };
}

export interface RatesUpdateActionState {
  success?: boolean;
  updated?: number;
  error?: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function parseCode(input: FormDataEntryValue | null): string {
  return input?.toString().trim().toUpperCase() ?? "";
}

export async function createCurrency(
  _prev: CurrencyActionState,
  formData: FormData
): Promise<CurrencyActionState> {
  const code = parseCode(formData.get("code"));
  const name = formData.get("name")?.toString().trim() ?? "";
  const symbol = formData.get("symbol")?.toString().trim() ?? "";
  const sortOrderStr = formData.get("sortOrder")?.toString() ?? "0";
  const sortOrder = parseInt(sortOrderStr, 10);

  const errors: NonNullable<CurrencyActionState["errors"]> = {};
  if (!code || code.length !== 3) errors.code = "Код валюты: ровно 3 символа";
  if (!name) errors.name = "Укажите название валюты";
  if (!symbol) errors.symbol = "Укажите символ валюты";
  if (Number.isNaN(sortOrder)) errors.sortOrder = "Некорректный порядок";
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.currency.create({
      data: { code, name, symbol, sortOrder, isActive: true },
    });
  } catch {
    return { errors: { general: "Не удалось создать валюту (возможно, код уже существует)" } };
  }

  revalidatePath("/currencies");
  revalidatePath("/settings");
  redirect("/currencies");
}

export async function updateCurrency(
  code: string,
  _prev: CurrencyActionState,
  formData: FormData
): Promise<CurrencyActionState> {
  const name = formData.get("name")?.toString().trim() ?? "";
  const symbol = formData.get("symbol")?.toString().trim() ?? "";
  const isActive = formData.get("isActive") === "on";
  const sortOrderStr = formData.get("sortOrder")?.toString() ?? "0";
  const sortOrder = parseInt(sortOrderStr, 10);

  const errors: NonNullable<CurrencyActionState["errors"]> = {};
  if (!name) errors.name = "Укажите название валюты";
  if (!symbol) errors.symbol = "Укажите символ валюты";
  if (Number.isNaN(sortOrder)) errors.sortOrder = "Некорректный порядок";
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.currency.update({
      where: { code: code.toUpperCase() },
      data: { name, symbol, isActive, sortOrder },
    });
  } catch {
    return { errors: { general: "Не удалось обновить валюту" } };
  }

  revalidatePath("/currencies");
  revalidatePath("/settings");
  redirect("/currencies");
}

export async function upsertExchangeRateAction(
  _prev: CurrencyActionState,
  formData: FormData
): Promise<CurrencyActionState> {
  const fromCurrency = parseCode(formData.get("fromCurrency"));
  const toCurrency = parseCode(formData.get("toCurrency"));
  const rateStr = formData.get("rate")?.toString() ?? "";
  const rate = parseFloat(rateStr);

  const errors: NonNullable<CurrencyActionState["errors"]> = {};
  if (!fromCurrency || fromCurrency.length !== 3) {
    errors.fromCurrency = "Выберите валюту источника";
  }
  if (!toCurrency || toCurrency.length !== 3) {
    errors.toCurrency = "Выберите валюту назначения";
  }
  if (fromCurrency && toCurrency && fromCurrency === toCurrency) {
    errors.toCurrency = "Валюты должны отличаться";
  }
  if (Number.isNaN(rate) || rate <= 0) {
    errors.rate = "Укажите курс больше 0";
  }
  if (Object.keys(errors).length > 0) return { errors };

  const [fromExists, toExists] = await Promise.all([
    prisma.currency.findUnique({ where: { code: fromCurrency }, select: { code: true } }),
    prisma.currency.findUnique({ where: { code: toCurrency }, select: { code: true } }),
  ]);
  if (!fromExists || !toExists) {
    return { errors: { general: "Одна из валют отсутствует в справочнике" } };
  }

  try {
    await prisma.exchangeRate.create({
      data: {
        fromCurrency,
        toCurrency,
        rate,
        date: new Date(),
        source: "manual",
      },
    });
  } catch {
    return { errors: { general: "Не удалось сохранить курс" } };
  }

  revalidatePath("/currencies");
  revalidatePath("/");
  revalidatePath("/analytics");
  return {};
}

export async function triggerRatesUpdate(): Promise<RatesUpdateActionState> {
  const requestHeaders = await headers();
  const hostHeader = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protoHeader = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = hostHeader?.split(",")[0]?.trim();
  const protocol = protoHeader.split(",")[0]?.trim() || "http";

  const applyRevalidate = () => {
    revalidatePath("/currencies");
    revalidatePath("/");
    revalidatePath("/analytics");
  };

  if (host) {
    try {
      const response = await fetch(`${protocol}://${host}/api/update-rates`, {
        method: "POST",
        cache: "no-store",
      });
      const data = (await response.json()) as { ok?: boolean; updated?: number; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "ЦБ РФ временно недоступен. Попробуйте позже.");
      }

      applyRevalidate();
      return { success: true, updated: data.updated ?? 0 };
    } catch (error) {
      console.error("[triggerRatesUpdate] endpoint call failed:", error);
      // Fallback: если внутренний вызов endpoint не сработал из-за host/proxy,
      // обновляем напрямую, чтобы кнопка продолжала работать.
    }
  }

  try {
    const updated = await updateExchangeRates();
    applyRevalidate();
    return { success: true, updated };
  } catch (error) {
    console.error("[triggerRatesUpdate] direct update failed:", error);
    return { error: getErrorMessage(error, "ЦБ РФ временно недоступен. Попробуйте позже.") };
  }
}
