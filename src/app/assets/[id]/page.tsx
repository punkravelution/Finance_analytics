import { notFound } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Vault,
  ChevronLeft,
  Pencil,
  Clock,
  Coins,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";
import {
  ASSET_TYPE_LABELS,
  VAULT_TYPE_LABELS,
  type AssetType,
  type VaultType,
} from "@/types";
import { AddValuationForm } from "@/components/assets/AddValuationForm";
import { AddIncomeEventForm } from "@/components/assets/AddIncomeEventForm";
import { ValuationRow } from "@/components/assets/ValuationRow";
import { IncomeEventRow } from "@/components/assets/IncomeEventRow";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AssetDetailPage({ params }: Props) {
  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      vault: true,
      valuations: {
        orderBy: { date: "desc" },
      },
      incomeEvents: {
        orderBy: { date: "desc" },
      },
    },
  });

  if (!asset || !asset.isActive) notFound();

  const cost = (asset.averageBuyPrice ?? 0) * asset.quantity;
  const currentValue = asset.currentTotalValue ?? 0;
  const pnl = currentValue - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Навигация */}
      <div className="mb-5">
        <Link
          href="/assets"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors w-fit"
        >
          <ChevronLeft size={14} />
          Все активы
        </Link>
      </div>

      {/* Заголовок */}
      <div className="flex items-start justify-between mb-7">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-purple-400">
              {asset.ticker ?? asset.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{asset.name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="outline">
                {ASSET_TYPE_LABELS[asset.assetType as AssetType]}
              </Badge>
              {asset.ticker && (
                <Badge variant="info">{asset.ticker}</Badge>
              )}
              <Badge variant="default">{asset.currency}</Badge>
            </div>
          </div>
        </div>

        <Link
          href={`/assets/${id}/edit`}
          className="flex items-center gap-1.5 px-4 py-2 bg-[hsl(222,47%,12%)] hover:bg-[hsl(222,47%,16%)] border border-[hsl(216,34%,20%)] rounded-lg text-sm text-slate-300 transition-colors"
        >
          <Pencil size={14} />
          Редактировать
        </Link>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Количество</p>
          <p className="text-xl font-bold text-white tabular-nums">
            {formatNumber(asset.quantity)}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">{asset.unit}</p>
        </div>

        {asset.currentUnitPrice != null && (
          <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Текущая цена</p>
            <p className="text-xl font-bold text-white tabular-nums">
              {formatCurrency(asset.currentUnitPrice, asset.currency)}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">за единицу</p>
          </div>
        )}

        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Текущая стоимость</p>
          <p className="text-xl font-bold text-white tabular-nums">
            {formatCurrency(currentValue, asset.currency)}
          </p>
        </div>

        {asset.averageBuyPrice != null && (
          <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Средняя цена</p>
            <p className="text-xl font-bold text-white tabular-nums">
              {formatCurrency(asset.averageBuyPrice, asset.currency)}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">цена покупки</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* P&L */}
        {cost > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Прибыль / убыток</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Вложено</span>
                  <span className="text-white tabular-nums">
                    {formatCurrency(cost, asset.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Сейчас</span>
                  <span className="text-white tabular-nums">
                    {formatCurrency(currentValue, asset.currency)}
                  </span>
                </div>
                <div className="pt-2 border-t border-[hsl(216,34%,17%)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {pnl >= 0 ? (
                        <TrendingUp size={16} className="text-green-400" />
                      ) : pnl < 0 ? (
                        <TrendingDown size={16} className="text-red-400" />
                      ) : (
                        <Minus size={16} className="text-slate-500" />
                      )}
                      <span
                        className={`text-lg font-bold tabular-nums ${
                          pnl >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {formatCurrency(pnl, asset.currency)}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        pnlPct >= 0 ? "text-green-500/80" : "text-red-500/80"
                      }`}
                    >
                      {formatPercent(pnlPct)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Хранилище */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vault size={14} />
              Хранилище
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/vaults/${asset.vault.id}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-[hsl(216,34%,12%)] transition-colors -mx-3"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{
                  backgroundColor: asset.vault.color
                    ? `${asset.vault.color}20`
                    : "#1e293b",
                }}
              >
                {asset.vault.icon ?? "🏦"}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {asset.vault.name}
                </p>
                <p className="text-xs text-slate-500">
                  {VAULT_TYPE_LABELS[asset.vault.type as VaultType]}
                </p>
              </div>
            </Link>

            {asset.lastUpdatedAt && (
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[hsl(216,34%,17%)]">
                <Clock size={12} className="text-slate-600" />
                <span className="text-xs text-slate-600">
                  Обновлено {formatDate(asset.lastUpdatedAt)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Заметки */}
        {asset.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Заметки</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 italic">{asset.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* История оценок */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={14} />
              История оценок
            </CardTitle>
            <AddValuationForm assetId={id} />
          </div>
        </CardHeader>
        <CardContent>
          {asset.valuations.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <TrendingUp size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">Записей об оценке нет</p>
              <p className="text-xs mt-1 text-slate-700">
                Нажмите «Добавить оценку», чтобы зафиксировать текущую цену
              </p>
            </div>
          ) : (
            <div>
              {asset.valuations.map((v) => (
                <ValuationRow
                  key={v.id}
                  assetId={id}
                  valuation={v}
                  currency={asset.currency}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Доходные события */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Coins size={14} />
              Доходные события
            </CardTitle>
            <AddIncomeEventForm
              assetId={id}
              vaultId={asset.vaultId}
              defaultCurrency={asset.currency}
            />
          </div>
        </CardHeader>
        <CardContent>
          {asset.incomeEvents.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <Coins size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">Доходных событий нет</p>
              <p className="text-xs mt-1 text-slate-700">
                Нажмите «Добавить событие» для записи дивиденда, купона или стейкинга
              </p>
            </div>
          ) : (
            <div>
              {asset.incomeEvents.map((e) => (
                <IncomeEventRow
                  key={e.id}
                  assetId={id}
                  event={e}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
