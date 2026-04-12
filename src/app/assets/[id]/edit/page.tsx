import { notFound } from "next/navigation";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetForm } from "@/components/forms/AssetForm";
import { prisma } from "@/lib/prisma";
import { updateAsset, deleteAsset, permanentlyDeleteAsset } from "@/app/actions/asset";
import { getExchangeRates } from "@/lib/currency";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditAssetPage({ params }: Props) {
  const { id } = await params;

  const [asset, vaults, currencies, rates] = await Promise.all([
    prisma.asset.findUnique({ where: { id } }),
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

  if (!asset || !asset.isActive) notFound();

  const action = updateAsset.bind(null, id);
  const deleteAction = deleteAsset.bind(null, id);
  const hardDeleteAction = permanentlyDeleteAsset.bind(null, id);
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
          Редактировать актив
        </h1>
        <p className="text-sm text-slate-500 mt-1">{asset.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры актива</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm
            key={asset.id}
            action={action}
            vaults={vaults}
            currencies={currencies}
            ratesToRub={ratesToRub}
            cancelHref={`/assets/${id}`}
            submitLabel="Сохранить изменения"
            defaultValues={{
              name: asset.name,
              assetType: asset.assetType,
              vaultId: asset.vaultId,
              ticker: asset.ticker,
              coinGeckoId: asset.coinGeckoId,
              steamMarketHashName: asset.steamMarketHashName,
              quantity: asset.quantity,
              unit: asset.unit,
              averageBuyPrice: asset.averageBuyPrice,
              currentUnitPrice: asset.currentUnitPrice,
              currency: asset.currency,
              notes: asset.notes,
            }}
          />
        </CardContent>
      </Card>

      {/* Управление жизненным циклом */}
      <div className="mt-8 p-4 border border-amber-500/20 rounded-xl bg-amber-500/5">
        <h3 className="text-sm font-medium text-amber-300 mb-2">Управление активом</h3>
        <p className="text-xs text-slate-500 mb-4">
          Выберите действие в зависимости от сценария: скрыть, удалить ошибку или продать.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <Link
            href={`/assets/${id}/sell`}
            className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-sm font-medium transition-colors"
          >
            Продать / вывести из портфеля
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,9%)]">
            <p className="text-sm text-slate-200 mb-1">Скрыть из интерфейса</p>
            <p className="text-xs text-slate-500 mb-3">
              Актив останется в базе и может быть восстановлен позже.
            </p>
            <form action={deleteAction}>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-700/40 hover:bg-slate-700/60 border border-slate-500/40 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                Скрыть из интерфейса
              </button>
            </form>
          </div>

          <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
            <p className="text-sm text-red-300 mb-1">Удалить ошибочно созданный актив</p>
            <p className="text-xs text-slate-500 mb-3">
              Полное удаление из базы. Используйте только для ошибочных записей.
            </p>
            <form action={hardDeleteAction}>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 rounded-lg text-sm font-medium transition-colors"
              >
                Удалить ошибочно созданный актив
              </button>
            </form>
          </div>
        </div>

        <p className="text-xs text-slate-600 mt-3">
          Важно: продажа и удаление — разные действия. Для продажи используйте отдельную кнопку.
        </p>
      </div>
    </div>
  );
}
