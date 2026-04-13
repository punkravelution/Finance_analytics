import { prisma } from "@/lib/prisma";
import { getBaseCurrency, getExchangeRates } from "@/lib/currency";
import { getVaultBalanceInCurrency, type VaultForBalance } from "@/lib/vaultBalance";

/**
 * Создаёт дневные снимки баланса по каждому активному хранилищу (в базовой валюте).
 * Пропускает хранилища, для которых снимок за текущие UTC-сутки уже есть.
 */
export async function executeCapitalSnapshot(): Promise<{ created: number; skipped: number }> {
  const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getExchangeRates()]);

  const now = new Date();
  const snapshotDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );

  const vaults = await prisma.vault.findMany({
    where: { isActive: true, includeInNetWorth: true },
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

    try {
      await prisma.vaultSnapshot.create({
        data: {
          vaultId: v.id,
          date: snapshotDate,
          balance: balanceInBase,
          currency: baseCurrency,
          source: "auto",
        },
      });
      created += 1;
    } catch (e: unknown) {
      const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "P2002") {
        skipped += 1;
        continue;
      }
      throw e;
    }
  }

  return { created, skipped };
}
