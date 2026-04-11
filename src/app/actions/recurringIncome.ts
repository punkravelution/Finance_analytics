"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { convertAmount, getBaseCurrency, getExchangeRates } from "@/lib/currency";
import type { CreateRecurringIncomeInput } from "@/types";

type UpdateRecurringIncomeInput = Partial<CreateRecurringIncomeInput>;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getCurrentMonthRangeUtc(now: Date): { monthStart: Date; monthEndExclusive: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    monthStart: new Date(Date.UTC(year, month, 1)),
    monthEndExclusive: new Date(Date.UTC(year, month + 1, 1)),
  };
}

function getLastDayOfUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function countOccurrencesInCurrentMonth(nextIncomeDate: Date, period: string, now: Date): number {
  const { monthStart, monthEndExclusive } = getCurrentMonthRangeUtc(now);
  const anchor = startOfUtcDay(nextIncomeDate);

  if (period === "biweekly") {
    // Project rule: in corporate practice "biweekly" means exactly 2 payouts per month.
    return 2;
  }

  if (period === "weekly") {
    const intervalDays = 7;
    const intervalMs = intervalDays * DAY_MS;
    const startDiff = monthStart.getTime() - anchor.getTime();
    const endDiff = monthEndExclusive.getTime() - 1 - anchor.getTime();
    const fromStep = Math.ceil(startDiff / intervalMs);
    const toStep = Math.floor(endDiff / intervalMs);
    return Math.max(0, toStep - fromStep + 1);
  }

  if (period === "monthly") {
    const day = anchor.getUTCDate();
    const year = monthStart.getUTCFullYear();
    const month = monthStart.getUTCMonth();
    const lastDay = getLastDayOfUtcMonth(year, month);
    const occurrenceDay = Math.min(day, lastDay);
    const occurrence = new Date(Date.UTC(year, month, occurrenceDay));
    return occurrence >= monthStart && occurrence < monthEndExclusive ? 1 : 0;
  }

  if (period === "yearly") {
    const anchorMonth = anchor.getUTCMonth();
    const currentMonth = monthStart.getUTCMonth();
    if (anchorMonth !== currentMonth) return 0;

    const day = anchor.getUTCDate();
    const year = monthStart.getUTCFullYear();
    const lastDay = getLastDayOfUtcMonth(year, currentMonth);
    const occurrenceDay = Math.min(day, lastDay);
    const occurrence = new Date(Date.UTC(year, currentMonth, occurrenceDay));
    return occurrence >= monthStart && occurrence < monthEndExclusive ? 1 : 0;
  }

  return 0;
}

export async function getRecurringIncomes() {
  return prisma.recurringIncome.findMany({
    include: { vault: true },
    orderBy: { nextIncomeDate: "asc" },
  });
}

export async function getRecurringIncomeById(id: string) {
  const row = await prisma.recurringIncome.findUnique({
    where: { id },
  });
  if (!row) return null;
  return {
    ...row,
    billingPeriod: row.billingPeriod as CreateRecurringIncomeInput["billingPeriod"],
    category: row.category as CreateRecurringIncomeInput["category"],
    note: row.note ?? undefined,
  };
}

export async function createRecurringIncome(data: CreateRecurringIncomeInput) {
  const recurringIncome = await prisma.recurringIncome.create({
    data: {
      ...data,
      isActive: data.isActive ?? true,
      note: data.note ?? null,
    },
  });

  revalidatePath("/recurring-incomes");
  return recurringIncome;
}

export async function updateRecurringIncome(id: string, data: UpdateRecurringIncomeInput) {
  const recurringIncome = await prisma.recurringIncome.update({
    where: { id },
    data: {
      ...data,
      note: data.note === undefined ? undefined : data.note ?? null,
    },
  });

  revalidatePath("/recurring-incomes");
  return recurringIncome;
}

export async function deleteRecurringIncome(id: string) {
  const recurringIncome = await prisma.recurringIncome.delete({
    where: { id },
  });

  revalidatePath("/recurring-incomes");
  return recurringIncome;
}

export async function getTotalMonthlyIncome(): Promise<{
  totalMonthly: number;
  totalYearly: number;
  currency: string;
}> {
  const [baseCurrency, rates, recurringIncomes] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
    prisma.recurringIncome.findMany({
      where: { isActive: true },
      select: {
        amount: true,
        currency: true,
        billingPeriod: true,
        nextIncomeDate: true,
      },
    }),
  ]);

  const now = new Date();
  const totalMonthly = recurringIncomes.reduce((sum, income) => {
    const occurrences = countOccurrencesInCurrentMonth(
      income.nextIncomeDate,
      income.billingPeriod,
      now
    );
    const monthlyAmount = income.amount * occurrences;
    const amountInBase = convertAmount(monthlyAmount, income.currency, baseCurrency, rates);
    return sum + amountInBase;
  }, 0);

  return {
    totalMonthly,
    totalYearly: totalMonthly * 12,
    currency: baseCurrency,
  };
}
