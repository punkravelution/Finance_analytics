import { notFound } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  Layers,
  ArrowLeftRight,
  Pencil,
  ChevronLeft,
  Link2,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpdateSteamPricesForm } from "@/components/assets/UpdateSteamPricesForm";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { getVaultBalance, BALANCE_SOURCE_LABELS } from "@/lib/vaultBalance";
import { getExchangeRates } from "@/lib/currency";
import {
  VAULT_TYPE_LABELS,
  LIQUIDITY_LABELS,
  RISK_LABELS,
  ASSET_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
  VAULT_RELATION_TYPE_LABELS,
  type VaultType,
  type LiquidityLevel,
  type RiskLevel,
  type AssetType,
  type VaultRelationType,
} from "@/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const liquidityVariant: Record<
  string,
  "success" | "warning" | "danger" | "default"
> = {
  high: "success",
  medium: "warning",
  low: "danger",
  illiquid: "default",
};

const riskVariant: Record<
  string,
  "success" | "warning" | "danger" | "default" | "info"
> = {
  none: "success",
  low: "info",
  medium: "warning",
  high: "danger",
  extreme: "danger",
};

const txTypeVariant: Record<string, "success" | "danger" | "info"> = {
  income: "success",
  expense: "danger",
  transfer: "info",
};

export default async function VaultDetailPage({ params }: Props) {
  const { id } = await params;
  const rates = await getExchangeRates();

  const vault = await prisma.vault.findUnique({
    where: { id },
    include: {
      assets: {
        where: { isActive: true },
        orderBy: { name: "asc" },
      },
      snapshots: {
        orderBy: { date: "desc" },
        take: 10,
      },
      transactionsFrom: {
        include: { category: true, toVault: true },
        orderBy: { date: "desc" },
        take: 10,
      },
      transactionsTo: {
        include: { category: true, fromVault: true },
        orderBy: { date: "desc" },
        take: 10,
      },
      relationsFrom: {
        include: { toVault: true },
        orderBy: { createdAt: "desc" },
      },
      relationsTo: {
        include: { fromVault: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!vault || !vault.isActive) notFound();

  // Текущий баланс через единый источник (MANUAL или ASSETS)
  const { balance } = getVaultBalance(vault, rates);
  const lastSnapshot = vault.snapshots[0];

  // Объединить и отсортировать транзакции
  const allTransactions = [
    ...vault.transactionsFrom.map((tx) => ({ ...tx, direction: "from" as const })),
    ...vault.transactionsTo.map((tx) => ({ ...tx, direction: "to" as const })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10);

  const totalAssetValue = vault.assets.reduce(
    (s, a) => s + (a.currentTotalValue ?? 0),
    0
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Навигация */}
      <div className="mb-5">
        <Link
          href="/vaults"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors w-fit"
        >
          <ChevronLeft size={14} />
          Все хранилища
        </Link>
      </div>

      {/* Заголовок */}
      <div className="flex items-start justify-between mb-7">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{
              backgroundColor: vault.color ? `${vault.color}20` : "#1e293b",
            }}
          >
            {vault.icon ?? "🏦"}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{vault.name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="outline">
                {VAULT_TYPE_LABELS[vault.type as VaultType]}
              </Badge>
              <Badge
                variant={
                  liquidityVariant[vault.liquidityLevel] as
                    | "success"
                    | "warning"
                    | "danger"
                    | "default"
                }
              >
                {LIQUIDITY_LABELS[vault.liquidityLevel as LiquidityLevel]}
              </Badge>
              <Badge
                variant={
                  riskVariant[vault.riskLevel] as
                    | "success"
                    | "warning"
                    | "danger"
                    | "default"
                    | "info"
                }
              >
                Риск: {RISK_LABELS[vault.riskLevel as RiskLevel]}
              </Badge>
              <Badge variant={vault.balanceSource === "MANUAL" ? "info" : "default"}>
                {BALANCE_SOURCE_LABELS[vault.balanceSource] ?? vault.balanceSource}
              </Badge>
              {vault.includeInSpendableBalance && (
                <Badge variant="success">Доступный баланс</Badge>
              )}
              {vault.includeInLiquidCapital && !vault.includeInSpendableBalance && (
                <Badge variant="info">Ликвидный капитал</Badge>
              )}
              {!vault.includeInNetWorth && (
                <Badge variant="default">Не в капитале</Badge>
              )}
            </div>
          </div>
        </div>

        <Link
          href={`/vaults/${id}/edit`}
          className="flex items-center gap-1.5 px-4 py-2 bg-[hsl(222,47%,12%)] hover:bg-[hsl(222,47%,16%)] border border-[hsl(216,34%,20%)] rounded-lg text-sm text-slate-300 transition-colors"
        >
          <Pencil size={14} />
          Редактировать
        </Link>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        <div className="col-span-2 bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Текущий баланс</p>
          <p className="text-2xl font-bold tabular-nums text-white">
            {formatCurrency(balance, vault.currency)}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">{vault.currency}</p>
        </div>

        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Активов</p>
          <p className="text-xl font-bold text-white">{vault.assets.length}</p>
          {vault.assets.length > 0 && (
            <p className="text-xs text-slate-600 mt-0.5">
              {formatCurrency(totalAssetValue, vault.currency)}
            </p>
          )}
        </div>

        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Снимков баланса</p>
          <p className="text-xl font-bold text-white">{vault.snapshots.length}</p>
          {lastSnapshot && (
            <p className="text-xs text-slate-600 mt-0.5">
              {formatDate(lastSnapshot.date)}
            </p>
          )}
        </div>
      </div>

      {vault.notes && (
        <p className="text-sm text-slate-500 italic mb-7 px-1">{vault.notes}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Активы */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Layers size={14} />
                Активы в хранилище
              </CardTitle>
              <div className="flex items-center gap-2">
                {vault.type === "steam" && <UpdateSteamPricesForm />}
                <Link
                  href={`/assets/new`}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  + Добавить
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {vault.assets.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                <TrendingUp size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Активов нет</p>
                <Link
                  href="/assets/new"
                  className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300"
                >
                  Добавить первый актив
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {vault.assets.map((asset) => {
                  const pnl =
                    (asset.currentTotalValue ?? 0) -
                    (asset.averageBuyPrice ?? 0) * asset.quantity;
                  return (
                    <Link
                      key={asset.id}
                      href={`/assets/${asset.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-[hsl(216,34%,12%)] transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-purple-400">
                          {asset.ticker ??
                            asset.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {asset.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatNumber(asset.quantity)} {asset.unit} ·{" "}
                          {ASSET_TYPE_LABELS[asset.assetType as AssetType]}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-white tabular-nums">
                          {formatCurrency(
                            asset.currentTotalValue ?? 0,
                            asset.currency
                          )}
                        </p>
                        {pnl !== 0 && (
                          <p
                            className={`text-[11px] tabular-nums ${pnl >= 0 ? "text-green-500/70" : "text-red-500/70"}`}
                          >
                            {pnl >= 0 ? "+" : ""}
                            {formatCurrency(pnl, asset.currency)}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Последние транзакции */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight size={14} />
                Последние операции
              </CardTitle>
              <Link
                href="/transactions/new"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Добавить
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {allTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                <ArrowLeftRight size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Операций нет</p>
              </div>
            ) : (
              <div className="space-y-1">
                {allTransactions.map((tx) => (
                  <Link
                    key={`${tx.id}-${tx.direction}`}
                    href={`/transactions/${tx.id}/edit`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-[hsl(216,34%,12%)] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-md bg-[hsl(216,34%,15%)] flex items-center justify-center text-xs flex-shrink-0">
                      {tx.category?.icon ??
                        (tx.type === "income"
                          ? "💰"
                          : tx.type === "expense"
                            ? "💸"
                            : "🔄")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">
                        {tx.note ??
                          tx.category?.name ??
                          TRANSACTION_TYPE_LABELS[
                            tx.type as keyof typeof TRANSACTION_TYPE_LABELS
                          ]}
                      </p>
                      <p className="text-xs text-slate-600">
                        {formatDate(tx.date)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-sm font-medium tabular-nums ${
                          tx.type === "income"
                            ? "text-green-400"
                            : tx.type === "expense"
                              ? "text-red-400"
                              : "text-slate-300"
                        }`}
                      >
                        {tx.type === "income"
                          ? "+"
                          : tx.type === "expense"
                            ? "−"
                            : ""}
                        {formatCurrency(tx.amount, tx.currency)}
                      </p>
                      <Badge
                        variant={txTypeVariant[tx.type]}
                        className="mt-0.5"
                      >
                        {
                          TRANSACTION_TYPE_LABELS[
                            tx.type as keyof typeof TRANSACTION_TYPE_LABELS
                          ]
                        }
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* История баланса */}
      {vault.snapshots.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>История баланса</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {vault.snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="flex items-center justify-between py-2 px-1 border-b border-[hsl(216,34%,13%)] last:border-0"
                >
                  <span className="text-sm text-slate-400">
                    {formatDate(snap.date)}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-white">
                    {formatCurrency(snap.balance, snap.currency)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Связанные хранилища */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Link2 size={14} />
              Связанные хранилища
            </CardTitle>
            <Link
              href={`/vaults/${id}/relations/new`}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              + Добавить
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {vault.relationsFrom.length === 0 &&
          vault.relationsTo.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <Link2 size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Связей нет</p>
              <Link
                href={`/vaults/${id}/relations/new`}
                className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300"
              >
                Добавить первую связь
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {vault.relationsFrom.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/vaults/${id}/relations/${rel.id}/edit`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[hsl(216,34%,12%)] transition-colors group"
                >
                  <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <ArrowUpRight size={13} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">
                      {rel.toVault.icon ?? "🏦"} {rel.toVault.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {
                        VAULT_RELATION_TYPE_LABELS[
                          rel.relationType as VaultRelationType
                        ]
                      }
                      {rel.note ? ` · ${rel.note}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-500 tabular-nums">
                      сила {rel.strength}
                    </p>
                    <p className="text-[11px] text-slate-600 group-hover:text-slate-400 transition-colors">
                      исходящая
                    </p>
                  </div>
                </Link>
              ))}
              {vault.relationsTo.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/vaults/${id}/relations/${rel.id}/edit`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[hsl(216,34%,12%)] transition-colors group"
                >
                  <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <ArrowDownLeft size={13} className="text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">
                      {rel.fromVault.icon ?? "🏦"} {rel.fromVault.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {
                        VAULT_RELATION_TYPE_LABELS[
                          rel.relationType as VaultRelationType
                        ]
                      }
                      {rel.note ? ` · ${rel.note}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-500 tabular-nums">
                      сила {rel.strength}
                    </p>
                    <p className="text-[11px] text-slate-600 group-hover:text-slate-400 transition-colors">
                      входящая
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
