import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRightLeft, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { sellAsset } from "@/app/actions/asset";
import { AssetSellForm } from "@/components/forms/AssetSellForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SellAssetPage({ params }: Props) {
  const { id } = await params;

  const [asset, manualVaults] = await Promise.all([
    prisma.asset.findUnique({
      where: { id },
      include: { vault: { select: { id: true, name: true } } },
    }),
    prisma.vault.findMany({
      where: { isActive: true, balanceSource: "MANUAL" },
      select: { id: true, name: true, icon: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!asset || !asset.isActive) notFound();

  const action = sellAsset.bind(null, id);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <Link
          href={`/assets/${id}/edit`}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors w-fit"
        >
          <ChevronLeft size={14} />
          Назад к управлению активом
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft size={16} />
            Продать / вывести из портфеля
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 mb-4">
            Актив <span className="text-white font-medium">{asset.name}</span> будет
            скрыт из портфеля, а в выбранное денежное хранилище добавится доходная
            операция.
          </p>
          <AssetSellForm action={action} vaults={manualVaults} cancelHref={`/assets/${id}/edit`} />
        </CardContent>
      </Card>
    </div>
  );
}
