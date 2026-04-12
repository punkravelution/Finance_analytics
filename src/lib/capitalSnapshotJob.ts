import { prisma } from "@/lib/prisma";
import { getBaseCurrency, getExchangeRates } from "@/lib/currency";
import { getVaultBalanceInCurrency, type VaultForBalance } from "@/lib/vaultBalance";

/**
 * Создаёт дневные снимки баланса по каждому активному хранилищу (в базовой валюте).
 * Пропускает хранилища, для которых снимок за текущие локальные сутки уже есть.
 */
export async function executeCapitalSnapshot(): Promise<{ created: number; skipped: number }> {
  const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getExchangeRates()]);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const vaults = await prisma.vault.findMany({
    where: { isActive: true },
    include: {
      assets: {
        where: { isActive: true },
        select: { currentTotalValue: true, currency: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  let created = 0;
  let skipped = 0;

  for (const v of vaults) {
    const existing = await prisma.vaultSnapshot.findFirst({
      where: {
        vaultId: v.id,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const vaultFor: VaultForBalance = {
      balanceSource: v.balanceSource,
      manualBalance: v.manualBalance,
      currency: v.currency,
      assets: v.assets.map((a) => ({
        currentTotalValue: a.currentTotalValue,
        currency: a.currency,
      })),
    };

    const balanceInBase = getVaultBalanceInCurrency(vaultFor, baseCurrency, rates);

    await prisma.vaultSnapshot.create({
      data: {
        vaultId: v.id,
        date: new Date(),
        balance: balanceInBase,
        currency: baseCurrency,
        source: "auto",
      },
    });
    created += 1;
  }

  return { created, skipped };
}
