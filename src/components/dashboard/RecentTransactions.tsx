import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { TRANSACTION_TYPE_LABELS } from "@/types";
import Link from "next/link";

type TransactionWithRelations = {
  id: string;
  date: Date;
  type: string;
  amount: number;
  currency: string;
  note: string | null;
  category: { name: string; icon: string | null; color: string | null } | null;
  fromVault: { name: string } | null;
  toVault: { name: string } | null;
};

interface RecentTransactionsProps {
  transactions: TransactionWithRelations[];
}

const typeVariant: Record<string, "success" | "danger" | "info"> = {
  income: "success",
  expense: "danger",
  transfer: "info",
};

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Последние операции</CardTitle>
          <Link
            href="/transactions"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Все →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {transactions.slice(0, 8).map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[hsl(216,34%,12%)] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-[hsl(216,34%,15%)] flex items-center justify-center text-sm flex-shrink-0">
                {tx.category?.icon ?? (tx.type === "income" ? "💰" : tx.type === "expense" ? "💸" : "🔄")}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">
                  {tx.note ?? tx.category?.name ?? TRANSACTION_TYPE_LABELS[tx.type as keyof typeof TRANSACTION_TYPE_LABELS]}
                </p>
                <p className="text-[11px] text-slate-600">
                  {formatDate(tx.date)}
                  {tx.fromVault && ` · ${tx.fromVault.name}`}
                  {tx.toVault && tx.type === "transfer" && ` → ${tx.toVault.name}`}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    tx.type === "income"
                      ? "text-green-400"
                      : tx.type === "expense"
                      ? "text-red-400"
                      : "text-slate-300"
                  }`}
                >
                  {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
                  {formatCurrency(tx.amount, tx.currency)}
                </p>
                <Badge variant={typeVariant[tx.type]} className="mt-0.5">
                  {TRANSACTION_TYPE_LABELS[tx.type as keyof typeof TRANSACTION_TYPE_LABELS]}
                </Badge>
              </div>
            </div>
          ))}

          {transactions.length === 0 && (
            <p className="text-sm text-slate-600 text-center py-6">Операций нет</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
