import { notFound } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetForm } from "@/components/forms/AssetForm";
import { prisma } from "@/lib/prisma";
import { updateAsset, deleteAsset } from "@/app/actions/asset";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditAssetPage({ params }: Props) {
  const { id } = await params;

  const [asset, vaults] = await Promise.all([
    prisma.asset.findUnique({ where: { id } }),
    prisma.vault.findMany({
      where: { isActive: true },
      select: { id: true, name: true, icon: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!asset || !asset.isActive) notFound();

  const action = updateAsset.bind(null, id);
  const deleteAction = deleteAsset.bind(null, id);

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
            action={action}
            vaults={vaults}
            cancelHref={`/assets/${id}`}
            submitLabel="Сохранить изменения"
            defaultValues={{
              name: asset.name,
              assetType: asset.assetType,
              vaultId: asset.vaultId,
              ticker: asset.ticker,
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

      {/* Удаление */}
      <div className="mt-8 p-4 border border-red-500/20 rounded-xl bg-red-500/5">
        <h3 className="text-sm font-medium text-red-400 mb-2">Опасная зона</h3>
        <p className="text-xs text-slate-500 mb-3">
          Актив будет скрыт из интерфейса (не удалён из базы данных).
        </p>
        <form action={deleteAction}>
          <button
            type="submit"
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 rounded-lg text-sm font-medium transition-colors"
          >
            Деактивировать актив
          </button>
        </form>
      </div>
    </div>
  );
}
