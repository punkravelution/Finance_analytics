"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { deleteTransaction } from "@/app/actions/transaction";
import { formatCurrency } from "@/lib/format";
import { parseTagsJson } from "@/lib/transactionTags";
import { TRANSACTION_TYPE_LABELS, type TransactionType } from "@/types";
import { TransactionCategoryQuickPick, type CategoryOptionDto } from "./TransactionCategoryQuickPick";
import { TransactionNote } from "./TransactionNote";

const typeVariant: Record<string, "success" | "danger" | "info"> = {
  income: "success",
  expense: "danger",
  transfer: "info",
};

export interface TransactionListRowDto {
  id: string;
  type: string;
  amount: number;
  currency: string;
  note: string | null;
  tags: string | null;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
  fromVault: { id: string; name: string } | null;
  toVault: { id: string; name: string } | null;
}

interface TransactionListRowProps {
  tx: TransactionListRowDto;
  categories: CategoryOptionDto[];
}

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max).trimEnd()}…`;
}

export function TransactionListRow({ tx, categories }: TransactionListRowProps) {
  const typeLabels = TRANSACTION_TYPE_LABELS;
  const typeLabel = typeLabels[tx.type as TransactionType] ?? tx.type;
  const rawNote = tx.note?.trim() ?? "";
  const headline =
    rawNote.length > 0
      ? truncateText(rawNote, 96)
      : tx.category?.name ?? typeLabel;
  const tags = parseTagsJson(tx.tags);

  const icon =
    tx.category?.icon ??
    (tx.type === "income" ? "💰" : tx.type === "expense" ? "💸" : "🔄");

  const vaultLine =
    tx.fromVault != null
      ? `${tx.fromVault.name}${tx.toVault ? ` → ${tx.toVault.name}` : ""}`
      : tx.toVault != null
        ? `→ ${tx.toVault.name}`
        : null;

  const badgeVariant = typeVariant[tx.type] ?? "info";

  return (
    <div>
      <div className="flex items-start gap-2 px-2 py-2 hover:bg-[hsl(216,34%,10%)] transition-colors">
        <Link
          href={`/transactions/${tx.id}/edit`}
          className="flex flex-1 min-w-0 gap-3 px-2 py-1 items-start"
        >
          <div className="w-8 h-8 rounded-lg bg-[hsl(216,34%,15%)] flex items-center justify-center text-sm flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 truncate">{headline}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <TransactionCategoryQuickPick
                transactionId={tx.id}
                transactionType={tx.type}
                initialCategoryId={tx.categoryId}
                initialCategory={
                  tx.category
                    ? { id: tx.category.id, name: tx.category.name, color: tx.category.color }
                    : null
                }
                categories={categories}
              />
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/80"
                >
                  {tag}
                </span>
              ))}
            </div>
            {vaultLine && (
              <p className="text-[11px] text-slate-600 mt-0.5 truncate">{vaultLine}</p>
            )}
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
            <Badge variant={badgeVariant} className="mt-0.5">
              {typeLabels[tx.type as TransactionType]}
            </Badge>
          </div>
        </Link>
        <form action={deleteTransaction.bind(null, tx.id)} className="flex-shrink-0 pt-1">
          <button
            type="submit"
            className="px-2.5 py-1.5 text-[11px] rounded-md border border-red-500/30 text-red-400 hover:text-red-300 hover:border-red-500/50 transition-colors"
          >
            Удалить
          </button>
        </form>
      </div>
      <div className="px-4 pb-2 pl-[3.25rem]">
        <TransactionNote transactionId={tx.id} initialNote={tx.note} className="w-full max-w-[min(100%,36rem)]" />
      </div>
    </div>
  );
}
