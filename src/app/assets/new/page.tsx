import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetForm } from "@/components/forms/AssetForm";
import { prisma } from "@/lib/prisma";
import { createAsset } from "@/app/actions/asset";
import { getExchangeRates } from "@/lib/currency";

export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  const [vaults, currencies, rates] = await Promise.all([
    prisma.vault.findMany({
      where: { isActive: true },
      select: { id: true, name: true, icon: true, currency: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.currency.findMany({
      where: { isActive: true },
      select: { code: true, name: true, symbol: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
    getExchangeRates(),
  ]);

  const ratesToRub = currencies.reduce<Record<string, number>>((acc, currency) => {
    if (currency.code === "RUB") return acc;
    const rate = rates[currency.code]?.RUB;
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
      acc[currency.code] = rate;
    }
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp size={22} className="text-purple-400" />
          Новый актив
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры актива</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm
            action={createAsset}
            vaults={vaults}
            currencies={currencies}
            ratesToRub={ratesToRub}
            cancelHref="/assets"
            submitLabel="Добавить актив"
          />
        </CardContent>
      </Card>
    </div>
  );
}
