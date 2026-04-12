"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CreateGoalInput, GoalPriority } from "@/types";

export type UpdateGoalInput = Partial<CreateGoalInput>;

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.437;
const DAY_MS = 24 * 60 * 60 * 1000;

const PRIORITY_ORDER: Record<GoalPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetweenLocal(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime();
  const b = startOfLocalDay(to).getTime();
  return Math.round((b - a) / DAY_MS);
}

function fractionalMonthsUntil(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_MONTH;
}

function sortGoals<T extends { isCompleted: boolean; priority: string; targetDate: Date | null }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    const pa = PRIORITY_ORDER[a.priority as GoalPriority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority as GoalPriority] ?? 2;
    if (pa !== pb) return pa - pb;
    const da = a.targetDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const db = b.targetDate?.getTime() ?? Number.POSITIVE_INFINITY;
    return da - db;
  });
}

export async function getGoals() {
  const rows = await prisma.goal.findMany({
    include: { vault: true },
    orderBy: { createdAt: "desc" },
  });
  return sortGoals(rows);
}

export async function getGoalById(id: string) {
  const row = await prisma.goal.findUnique({
    where: { id },
    include: { vault: true },
  });
  if (!row) return null;
  return {
    ...row,
    category: row.category as CreateGoalInput["category"],
    priority: row.priority as CreateGoalInput["priority"],
    note: row.note ?? undefined,
  };
}

export interface GoalProgressItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate: Date | null;
  vaultId: string | null;
  category: string;
  priority: string;
  isCompleted: boolean;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  vault: { id: string; name: string; currency: string } | null;
  percentComplete: number;
  remaining: number;
  daysUntilTarget: number | null;
  monthlyRequired: number | null;
}

export async function getGoalsProgress(): Promise<GoalProgressItem[]> {
  const rows = await prisma.goal.findMany({
    include: { vault: true },
  });
  const now = new Date();
  const sorted = sortGoals(rows);

  return sorted.map((g) => {
    const target = g.targetAmount > 0 ? g.targetAmount : 1;
    const percentComplete = Math.min(100, Math.max(0, (g.currentAmount / target) * 100));
    const remaining = Math.max(0, g.targetAmount - g.currentAmount);
    const daysUntilTarget =
      g.targetDate != null ? daysBetweenLocal(now, g.targetDate) : null;
    let monthlyRequired: number | null = null;
    if (g.targetDate != null && remaining > 0) {
      const months = fractionalMonthsUntil(now, g.targetDate);
      if (months > 0) {
        const denom = Math.max(months, 1 / 30.437);
        monthlyRequired = remaining / denom;
      }
    }
    return {
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      currency: g.currency,
      targetDate: g.targetDate,
      vaultId: g.vaultId,
      category: g.category,
      priority: g.priority,
      isCompleted: g.isCompleted,
      note: g.note,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      vault: g.vault
        ? { id: g.vault.id, name: g.vault.name, currency: g.vault.currency }
        : null,
      percentComplete,
      remaining,
      daysUntilTarget,
      monthlyRequired,
    };
  });
}

export async function createGoal(data: CreateGoalInput) {
  const goal = await prisma.goal.create({
    data: {
      name: data.name,
      targetAmount: data.targetAmount,
      currentAmount: data.currentAmount ?? 0,
      currency: data.currency,
      targetDate: data.targetDate ?? null,
      vaultId: data.vaultId?.trim() ? data.vaultId : null,
      category: data.category,
      priority: data.priority,
      isCompleted: data.isCompleted ?? false,
      note: data.note ?? null,
    },
    include: { vault: true },
  });
  revalidatePath("/goals");
  revalidatePath("/goals/new");
  return goal;
}

export async function updateGoal(id: string, data: UpdateGoalInput) {
  const goal = await prisma.goal.update({
    where: { id },
    data: {
      name: data.name,
      targetAmount: data.targetAmount,
      currentAmount: data.currentAmount,
      currency: data.currency,
      targetDate: data.targetDate === undefined ? undefined : data.targetDate,
      vaultId:
        data.vaultId === undefined
          ? undefined
          : data.vaultId?.trim()
            ? data.vaultId
            : null,
      category: data.category,
      priority: data.priority,
      isCompleted: data.isCompleted,
      note: data.note === undefined ? undefined : data.note ?? null,
    },
    include: { vault: true },
  });
  revalidatePath("/goals");
  revalidatePath(`/goals/${id}/edit`);
  return goal;
}

export async function deleteGoal(id: string) {
  const goal = await prisma.goal.delete({ where: { id } });
  revalidatePath("/goals");
  return goal;
}

export async function addToGoalCurrentAmount(goalId: string, delta: number) {
  if (!Number.isFinite(delta) || delta <= 0) {
    throw new Error("Сумма должна быть положительным числом");
  }
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) {
    throw new Error("Цель не найдена");
  }
  const updated = await prisma.goal.update({
    where: { id: goalId },
    data: { currentAmount: goal.currentAmount + delta },
  });
  revalidatePath("/goals");
  return updated;
}
