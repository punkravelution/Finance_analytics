import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { VAULT_TYPE_LABELS, LIQUIDITY_LABELS, RISK_LABELS, type VaultType, type LiquidityLevel, type RiskLevel } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Vault, Layers, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

async function getVaults() {
  const vaults = await prisma.vault.findMany({
    where: { isActive: true },
    include: {
      assets: { where: { isActive: true } },
      snapshots: { orderBy: { date: "desc" }, take: 1 },
      _count: { select: { assets: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return vaults.map((v) => {
    const lastSnapshot = v.snapshots[0];
    const balance = lastSnapshot
      ? lastSnapshot.balance
      : v.assets.reduce((s, a) => s + (a.currentTotalValue ?? 0), 0);
    return { ...v, balance };
  });
}

const liquidityVariant: Record<string, "success" | "warning" | "danger" | "default"> = {
  high: "success",
  medium: "warning",
  low: "danger",
  illiquid: "default",
};

const riskVariant: Record<string, "success" | "warning" | "danger" | "default" | "info"> = {
  none: "success",
  low: "info",
  medium: "warning",
  high: "danger",
  extreme: "danger",
};

export default async function VaultsPage() {
  const vaults = await getVaults();
  const totalBalance = vaults.reduce((sum, v) => sum + (v.includeInNetWorth ? v.balance : 0), 0);

  const byType = vaults.reduce<Record<string, number>>((acc, v) => {
    acc[v.type] = (acc[v.type] ?? 0) + v.balance;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Vault size={22} className="text-blue-400" />
            Хранилища
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {vaults.length} активных · Итого: {formatCurrency(totalBalance)}
          </p>
        </div>
        <Link
          href="/vaults/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          Добавить
        </Link>
      </div>

      {/* Сводка по типам */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        {Object.entries(byType).map(([type, balance]) => (
          <div
            key={type}
            className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4"
          >
            <p className="text-xs text-slate-500 mb-1">
              {VAULT_TYPE_LABELS[type as VaultType] ?? type}
            </p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(balance)}</p>
          </div>
        ))}
      </div>

      {/* Список хранилищ */}
      <div className="space-y-3">
        {vaults.map((vault) => {
          const share = totalBalance > 0 ? (vault.balance / totalBalance) * 100 : 0;
          return (
            <Link key={vault.id} href={`/vaults/${vault.id}`} className="block">
            <Card className="hover:border-[hsl(216,34%,28%)] transition-colors cursor-pointer">
              <CardContent>
                <div className="flex items-start gap-4">
                  {/* Иконка */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: vault.color ? `${vault.color}20` : "#1e293b" }}
                  >
                    {vault.icon ?? "🏦"}
                  </div>

                  {/* Основная информация */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white">{vault.name}</h3>
                      <Badge variant="outline">
                        {VAULT_TYPE_LABELS[vault.type as VaultType]}
                      </Badge>
                      {!vault.includeInNetWorth && (
                        <Badge variant="default">Не в капитале</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <Badge variant={liquidityVariant[vault.liquidityLevel]}>
                        Ликвидность: {LIQUIDITY_LABELS[vault.liquidityLevel as LiquidityLevel]}
                      </Badge>
                      <Badge variant={riskVariant[vault.riskLevel] as "success" | "warning" | "danger" | "default" | "info"}>
                        Риск: {RISK_LABELS[vault.riskLevel as RiskLevel]}
                      </Badge>
                      {vault._count.assets > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Layers size={11} />
                          {vault._count.assets} активов
                        </span>
                      )}
                    </div>

                    {/* Прогресс-бар доли */}
                    <div className="flex items-center gap-2 mt-2.5">
                      <div className="flex-1 h-1.5 bg-[hsl(216,34%,15%)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500/60"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-600 w-10 text-right">
                        {share.toFixed(1)}%
                      </span>
                    </div>

                    {vault.notes && (
                      <p className="text-xs text-slate-600 mt-2 italic">{vault.notes}</p>
                    )}
                  </div>

                  {/* Баланс */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold tabular-nums text-white">
                      {formatCurrency(vault.balance, vault.currency)}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{vault.currency}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            </Link>
          );
        })}

        {vaults.length === 0 && (
          <div className="text-center py-16 text-slate-600">
            <Vault size={40} className="mx-auto mb-3 opacity-30" />
            <p>Хранилищ нет</p>
          </div>
        )}
      </div>
    </div>
  );
}
