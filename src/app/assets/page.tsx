import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { ASSET_TYPE_LABELS, type AssetType } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Plus } from "lucide-react";
import { UpdateSteamPricesForm } from "@/components/assets/UpdateSteamPricesForm";

export const dynamic = "force-dynamic";

async function getAssets() {
  return prisma.asset.findMany({
    where: { isActive: true },
    include: { vault: true },
    orderBy: [{ vault: { sortOrder: "asc" } }, { name: "asc" }],
  });
}

export default async function AssetsPage() {
  const assets = await getAssets();

  const totalValue = assets.reduce((sum, a) => sum + (a.currentTotalValue ?? 0), 0);
  const totalCost = assets.reduce(
    (sum, a) => sum + (a.averageBuyPrice ?? 0) * a.quantity,
    0
  );
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // Группировка по хранилищу
  const byVault = assets.reduce<Record<string, typeof assets>>((acc, a) => {
    const key = a.vaultId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp size={22} className="text-purple-400" />
            Активы
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {assets.length} активов · Стоимость: {formatCurrency(totalValue)}
          </p>
        </div>
        <Link
          href="/assets/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          Добавить
        </Link>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Текущая стоимость</p>
          <p className="text-xl font-bold tabular-nums">{formatCurrency(totalValue)}</p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Вложено (по средней)</p>
          <p className="text-xl font-bold tabular-nums">{formatCurrency(totalCost)}</p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Прибыль / убыток</p>
          <p
            className={`text-xl font-bold tabular-nums ${
              totalPnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {totalPnl >= 0 ? "+" : ""}
            {formatCurrency(totalPnl)}
          </p>
          <p
            className={`text-xs mt-0.5 ${
              totalPnlPct >= 0 ? "text-green-500/70" : "text-red-500/70"
            }`}
          >
            {totalPnlPct >= 0 ? "+" : ""}
            {totalPnlPct.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Группы по хранилищам */}
      <div className="space-y-6">
        {Object.entries(byVault).map(([vaultId, vaultAssets]) => {
          const vault = vaultAssets[0].vault;
          const vaultTotal = vaultAssets.reduce(
            (s, a) => s + (a.currentTotalValue ?? 0),
            0
          );

          return (
            <div key={vaultId}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{vault.icon ?? "🏦"}</span>
                  <h2 className="text-sm font-semibold text-slate-300">{vault.name}</h2>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-sm text-slate-500 tabular-nums">
                    {formatCurrency(vaultTotal, vault.currency)}
                  </span>
                </div>
                {vault.type === "steam" && <UpdateSteamPricesForm />}
              </div>

              <div className="space-y-2">
                {vaultAssets.map((asset) => {
                  const cost = (asset.averageBuyPrice ?? 0) * asset.quantity;
                  const currentValue = asset.currentTotalValue ?? 0;
                  const pnl = currentValue - cost;
                  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                  const share = vaultTotal > 0 ? (currentValue / vaultTotal) * 100 : 0;

                  return (
                    <Link key={asset.id} href={`/assets/${asset.id}`} className="block">
                    <Card
                      className="hover:border-[hsl(216,34%,28%)] transition-colors cursor-pointer"
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center gap-4">
                          {/* Тикер / иконка */}
                          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-purple-400">
                              {asset.ticker ?? asset.name.slice(0, 2).toUpperCase()}
                            </span>
                          </div>

                          {/* Название */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white truncate">{asset.name}</p>
                              <Badge variant="outline" className="flex-shrink-0">
                                {ASSET_TYPE_LABELS[asset.assetType as AssetType]}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatNumber(asset.quantity)} {asset.unit}
                              {asset.currentUnitPrice != null &&
                                ` · ${formatCurrency(asset.currentUnitPrice, asset.currency)} за ед.`}
                            </p>
                          </div>

                          {/* Доля */}
                          <div className="w-16 hidden sm:block">
                            <div className="h-1 bg-[hsl(216,34%,15%)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500/60 rounded-full"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1 text-right">
                              {share.toFixed(0)}%
                            </p>
                          </div>

                          {/* P&L */}
                          <div className="text-right hidden lg:block w-28">
                            <p
                              className={`text-sm font-medium tabular-nums ${
                                pnl >= 0 ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {pnl >= 0 ? "+" : ""}
                              {formatCurrency(pnl, asset.currency)}
                            </p>
                            <p
                              className={`text-xs ${
                                pnlPct >= 0 ? "text-green-500/60" : "text-red-500/60"
                              }`}
                            >
                              {pnlPct >= 0 ? "+" : ""}
                              {pnlPct.toFixed(1)}%
                            </p>
                          </div>

                          {/* Стоимость */}
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold tabular-nums text-white">
                              {formatCurrency(asset.currentTotalValue ?? 0, asset.currency)}
                            </p>
                            {asset.lastUpdatedAt && (
                              <p className="text-[10px] text-slate-600 mt-0.5">
                                {formatDate(asset.lastUpdatedAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {assets.length === 0 && (
          <div className="text-center py-16 text-slate-600">
            <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
            <p>Активов нет</p>
          </div>
        )}
      </div>
    </div>
  );
}
