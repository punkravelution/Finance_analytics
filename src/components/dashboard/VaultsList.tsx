import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { VAULT_TYPE_LABELS, LIQUIDITY_LABELS, type VaultSummary } from "@/types";
import Link from "next/link";

interface VaultsListProps {
  vaults: VaultSummary[];
}

const liquidityVariant: Record<string, "success" | "warning" | "danger" | "default"> = {
  high: "success",
  medium: "warning",
  low: "danger",
  illiquid: "default",
};

export function VaultsList({ vaults }: VaultsListProps) {
  // Общая сумма в базовой валюте (balanceInBaseCurrency уже нормализована)
  const totalBalance = vaults.reduce((sum, v) => sum + v.balanceInBaseCurrency, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Хранилища</CardTitle>
          <Link
            href="/vaults"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Все →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {vaults.slice(0, 6).map((vault) => {
            const share = totalBalance > 0 ? (vault.balance / totalBalance) * 100 : 0;
            return (
              <div
                key={vault.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-[hsl(216,34%,12%)] transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  style={{ backgroundColor: vault.color ? `${vault.color}20` : "#1e293b" }}
                >
                  {vault.icon ?? "🏦"}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-200 truncate">{vault.name}</p>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">
                      {VAULT_TYPE_LABELS[vault.type]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1 bg-[hsl(216,34%,15%)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500/60"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-600 w-8 text-right">
                      {share.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(vault.balance, vault.balanceCurrency)}
                  </p>
                  {vault.balanceCurrency !== vault.currency && (
                    <p className="text-[10px] text-slate-500 tabular-nums">
                      {vault.currency}
                    </p>
                  )}
                  <Badge variant={liquidityVariant[vault.liquidityLevel]} className="mt-0.5">
                    {LIQUIDITY_LABELS[vault.liquidityLevel]}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
