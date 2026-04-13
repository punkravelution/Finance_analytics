import { prisma } from "@/lib/prisma";

const RECONCILE_INTERVAL_MS = 10 * 60 * 1000;
const RECONCILE_SETTING_KEY = "manualBalanceLastReconciledAt";
const EPSILON = 0.000001;

export async function reconcileManualVaultBalancesIfDue(): Promise<{ checked: number; corrected: number }> {
  const setting = await prisma.appSettings.findUnique({
    where: { key: RECONCILE_SETTING_KEY },
    select: { value: true },
  });
  const lastAt = setting?.value ? new Date(setting.value) : null;
  if (lastAt && Number.isFinite(lastAt.getTime())) {
    const elapsed = Date.now() - lastAt.getTime();
    if (elapsed < RECONCILE_INTERVAL_MS) {
      return { checked: 0, corrected: 0 };
    }
  }

  const result = await reconcileManualVaultBalances();
  const nowIso = new Date().toISOString();
  await prisma.appSettings.upsert({
    where: { key: RECONCILE_SETTING_KEY },
    update: { value: nowIso },
    create: { key: RECONCILE_SETTING_KEY, value: nowIso },
  });
  return result;
}

async function reconcileManualVaultBalances(): Promise<{ checked: number; corrected: number }> {
  const manualVaults = await prisma.vault.findMany({
    where: { isActive: true, balanceSource: "MANUAL" },
    select: { id: true, manualBalance: true },
  });
  if (manualVaults.length === 0) return { checked: 0, corrected: 0 };

  const manualVaultIds = manualVaults.map((v) => v.id);

  const [incomeIn, expenseOut, transferIn, transferOut] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["toVaultId"],
      where: { type: "income", toVaultId: { in: manualVaultIds } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["fromVaultId"],
      where: { type: "expense", fromVaultId: { in: manualVaultIds } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["toVaultId"],
      where: { type: "transfer", toVaultId: { in: manualVaultIds } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["fromVaultId"],
      where: { type: "transfer", fromVaultId: { in: manualVaultIds } },
      _sum: { amount: true },
    }),
  ]);

  const expected = new Map<string, number>();
  for (const vault of manualVaults) expected.set(vault.id, 0);

  for (const row of incomeIn) {
    if (!row.toVaultId) continue;
    expected.set(row.toVaultId, (expected.get(row.toVaultId) ?? 0) + (row._sum.amount ?? 0));
  }
  for (const row of expenseOut) {
    if (!row.fromVaultId) continue;
    expected.set(row.fromVaultId, (expected.get(row.fromVaultId) ?? 0) - (row._sum.amount ?? 0));
  }
  for (const row of transferIn) {
    if (!row.toVaultId) continue;
    expected.set(row.toVaultId, (expected.get(row.toVaultId) ?? 0) + (row._sum.amount ?? 0));
  }
  for (const row of transferOut) {
    if (!row.fromVaultId) continue;
    expected.set(row.fromVaultId, (expected.get(row.fromVaultId) ?? 0) - (row._sum.amount ?? 0));
  }

  let corrected = 0;
  for (const vault of manualVaults) {
    const expectedBalance = expected.get(vault.id) ?? 0;
    if (Math.abs(vault.manualBalance - expectedBalance) <= EPSILON) continue;
    await prisma.vault.update({
      where: { id: vault.id },
      data: { manualBalance: expectedBalance },
    });
    corrected += 1;
  }

  return { checked: manualVaults.length, corrected };
}
