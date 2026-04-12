import { prisma } from "@/lib/prisma";

type LiabilityDb = Pick<typeof prisma, "liability">;

/** Уменьшение остатка долга при привязке платежа (расход). */
export async function applyLiabilityPayment(
  db: LiabilityDb,
  liabilityId: string,
  paymentAmount: number,
  currency: string
): Promise<void> {
  if (paymentAmount <= 0 || !Number.isFinite(paymentAmount)) return;
  const cur = currency.trim().toUpperCase() || "RUB";
  const l = await db.liability.findUnique({ where: { id: liabilityId } });
  if (!l || !l.isActive) return;
  if (l.currency.trim().toUpperCase() !== cur) return;
  const newBal = Math.max(0, l.currentBalance - paymentAmount);
  await db.liability.update({
    where: { id: liabilityId },
    data: { currentBalance: newBal },
  });
}

/** Возврат суммы на остаток при отвязке или смене привязки. */
export async function revertLiabilityPayment(
  db: LiabilityDb,
  liabilityId: string,
  paymentAmount: number,
  currency: string
): Promise<void> {
  if (paymentAmount <= 0 || !Number.isFinite(paymentAmount)) return;
  const cur = currency.trim().toUpperCase() || "RUB";
  const l = await db.liability.findUnique({ where: { id: liabilityId } });
  if (!l) return;
  if (l.currency.trim().toUpperCase() !== cur) return;
  const newBal = Math.min(l.principalAmount, l.currentBalance + paymentAmount);
  await db.liability.update({
    where: { id: liabilityId },
    data: { currentBalance: newBal },
  });
}
