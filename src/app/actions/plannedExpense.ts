"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CreatePlannedExpenseInput } from "@/types";

export type UpdatePlannedExpenseInput = Partial<CreatePlannedExpenseInput>;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetweenLocal(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime();
  const b = startOfLocalDay(to).getTime();
  return Math.round((b - a) / DAY_MS);
}

function addCalendarMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

export async function getPlannedExpenses() {
  return prisma.plannedExpense.findMany({
    include: { vault: true },
    orderBy: { dueDate: "asc" },
  });
}

export async function getPlannedExpenseById(id: string) {
  const row = await prisma.plannedExpense.findUnique({
    where: { id },
    include: { vault: true },
  });
  if (!row) return null;
  return {
    ...row,
    category: row.category as CreatePlannedExpenseInput["category"],
    note: row.note ?? undefined,
  };
}

export interface UpcomingPlannedExpense {
  id: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: Date;
  vaultId: string | null;
  category: string;
  isPaid: boolean;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  vault: { id: string; name: string; currency: string } | null;
  daysUntilDue: number;
}

export async function getUpcomingExpenses(): Promise<UpcomingPlannedExpense[]> {
  const now = new Date();
  const rows = await prisma.plannedExpense.findMany({
    where: { isPaid: false },
    include: { vault: true },
    orderBy: { dueDate: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    currency: r.currency,
    dueDate: r.dueDate,
    vaultId: r.vaultId,
    category: r.category,
    isPaid: r.isPaid,
    note: r.note,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    vault: r.vault
      ? { id: r.vault.id, name: r.vault.name, currency: r.vault.currency }
      : null,
    daysUntilDue: daysBetweenLocal(now, r.dueDate),
  }));
}

export interface CurrencyTotal {
  currency: string;
  total: number;
}

export async function getUnpaidTotalsForNextThreeMonths(): Promise<CurrencyTotal[]> {
  const now = new Date();
  const windowStart = startOfLocalDay(now);
  const windowEndExclusive = startOfLocalDay(addCalendarMonths(now, 3));

  const rows = await prisma.plannedExpense.findMany({
    where: {
      isPaid: false,
      dueDate: {
        gte: windowStart,
        lt: windowEndExclusive,
      },
    },
    select: { amount: true, currency: true },
  });

  const map = new Map<string, number>();
  for (const r of rows) {
    const c = r.currency.toUpperCase();
    map.set(c, (map.get(c) ?? 0) + r.amount);
  }
  return Array.from(map.entries()).map(([currency, total]) => ({ currency, total }));
}

export async function createPlannedExpense(data: CreatePlannedExpenseInput) {
  const row = await prisma.plannedExpense.create({
    data: {
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      dueDate: data.dueDate,
      vaultId: data.vaultId?.trim() ? data.vaultId : null,
      category: data.category,
      isPaid: data.isPaid ?? false,
      note: data.note ?? null,
    },
    include: { vault: true },
  });
  revalidatePath("/goals");
  revalidatePath("/planned-expenses/new");
  return row;
}

export async function updatePlannedExpense(id: string, data: UpdatePlannedExpenseInput) {
  const row = await prisma.plannedExpense.update({
    where: { id },
    data: {
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      dueDate: data.dueDate,
      vaultId:
        data.vaultId === undefined
          ? undefined
          : data.vaultId?.trim()
            ? data.vaultId
            : null,
      category: data.category,
      isPaid: data.isPaid,
      note: data.note === undefined ? undefined : data.note ?? null,
    },
    include: { vault: true },
  });
  revalidatePath("/goals");
  revalidatePath(`/planned-expenses/${id}/edit`);
  return row;
}

export async function deletePlannedExpense(id: string) {
  const row = await prisma.plannedExpense.delete({ where: { id } });
  revalidatePath("/goals");
  return row;
}

export async function markPlannedExpensePaid(id: string) {
  const row = await prisma.plannedExpense.update({
    where: { id },
    data: { isPaid: true },
  });
  revalidatePath("/goals");
  return row;
}
