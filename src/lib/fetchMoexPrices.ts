import { prisma } from "@/lib/prisma";

export interface MoexUpdateResult {
  updated: number;
  failed: number;
  errors: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function updateMoexPrices(baseUrl: string): Promise<MoexUpdateResult> {
  const assets = await prisma.asset.findMany({
    where: {
      isActive: true,
      assetType: "stock",
      ticker: { not: null },
    },
    select: { id: true, ticker: true, quantity: true },
    orderBy: { name: "asc" },
  });

  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const asset of assets) {
    const ticker = asset.ticker?.trim().toUpperCase();
    if (!ticker) continue;

    try {
      const response = await fetch(
        `${baseUrl}/api/moex-price?ticker=${encodeURIComponent(ticker)}`,
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error("not found");

      const json = (await response.json()) as { price?: number };
      if (typeof json.price !== "number" || !Number.isFinite(json.price) || json.price <= 0) {
        throw new Error("bad price");
      }

      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          currentUnitPrice: json.price,
          currentTotalValue: json.price * asset.quantity,
          currency: "RUB",
          lastUpdatedAt: new Date(),
        },
      });
      updated += 1;
    } catch {
      failed += 1;
      errors.push(ticker);
    }

    await sleep(300);
  }

  return { updated, failed, errors };
}
