"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { convertAmount, getBaseCurrency, getExchangeRates } from "@/lib/currency";
import type { CreateRecurringIncomeInput } from "@/types";

type UpdateRecurringIncomeInput = Partial<CreateRecurringIncomeInput>;

function monthlyMultiplier(period: string): number {
  switch (period) {
    case "monthly":
      return 1;
    case "weekly":
      return 4.33;
    case "biweekly":
      return 2.165;
    case "yearly":
      return 1 / 12;
    default:
      return 0;
  }
}

export async function getRecurringIncomes() {
  return prisma.recurringIncome.findMany({
    include: { vault: true },
    orderBy: { nextIncomeDate: "asc" },
  });
}

export async function getRecurringIncomeById(id: string) {
  return prisma.recurringIncome.findUnique({
    where: { id },
    include: { vault: true },
  });
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
      },
    }),
  ]);

  const totalMonthly = recurringIncomes.reduce((sum, income) => {
    const multiplier = monthlyMultiplier(income.billingPeriod);
    const monthlyAmount = income.amount * multiplier;
    const amountInBase = convertAmount(monthlyAmount, income.currency, baseCurrency, rates);
    return sum + amountInBase;
  }, 0);

  return {
    totalMonthly,
    totalYearly: totalMonthly * 12,
    currency: baseCurrency,
  };
}
