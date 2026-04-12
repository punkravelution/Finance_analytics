"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { deleteTransaction, unlinkTransaction } from "@/app/actions/transaction";
import { formatCurrency } from "@/lib/format";
import {
  parseTagsJson,
  TAG_LINK_LIABILITY,
  TAG_LINK_PLANNED_EXPENSE,
  TAG_LINK_RECURRING_INCOME,
  TAG_LINK_SUBSCRIPTION,
} from "@/lib/transactionTags";
import { TRANSACTION_TYPE_LABELS, type TransactionType } from "@/types";
import { TransactionCategoryQuickPick, type CategoryOptionDto } from "./TransactionCategoryQuickPick";
import { TransactionNote } from "./TransactionNote";
import {
  RecurringLinkButton,
  type RecurringOptionDto,
  type SubscriptionOptionDto,
} from "./RecurringLinkButton";
import { PlannedExpenseLinkButton, type PlannedExpenseOptionDto } from "./PlannedExpenseLinkButton";
import { LiabilityLinkButton, type LiabilityOptionDto } from "./LiabilityLinkButton";

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
  recurringIncome: { id: string; name: string } | null;
  subscription: { id: string; name: string } | null;
  plannedExpense: { id: string; name: string } | null;
  liability: { id: string; name: string } | null;
}

interface TransactionListRowProps {
  tx: TransactionListRowDto;
  categories: CategoryOptionDto[];
  recurringOptions: RecurringOptionDto[];
  subscriptionOptions: SubscriptionOptionDto[];
  plannedOptions: PlannedExpenseOptionDto[];
  liabilityOptions: LiabilityOptionDto[];
}

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max).trimEnd()}…`;
}

function UnlinkControl({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await unlinkTransaction(transactionId);
          router.refresh();
        })
      }
      className="text-[10px] text-slate-500 hover:text-slate-300 underline-offset-2 hover:underline"
    >
      {pending ? "…" : "отвязать"}
    </button>
  );
}

export function TransactionListRow({
  tx,
  categories,
  recurringOptions,
  subscriptionOptions,
  plannedOptions,
  liabilityOptions,
}: TransactionListRowProps) {
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
              {tags.map((tag) => {
                const isLinkTag =
                  tag === TAG_LINK_SUBSCRIPTION ||
                  tag === TAG_LINK_RECURRING_INCOME ||
                  tag === TAG_LINK_PLANNED_EXPENSE ||
                  tag === TAG_LINK_LIABILITY;
                let linkClass =
                  "text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/80";
                if (isLinkTag) {
                  if (tag === TAG_LINK_SUBSCRIPTION) {
                    linkClass =
                      "text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30";
                  } else if (tag === TAG_LINK_RECURRING_INCOME) {
                    linkClass =
                      "text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/30";
                  } else if (tag === TAG_LINK_PLANNED_EXPENSE) {
                    linkClass =
                      "text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-500/30";
                  } else {
                    linkClass =
                      "text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-200 border border-rose-500/30";
                  }
                }
                return (
                  <span key={tag} className={linkClass}>
                    {tag}
                  </span>
                );
              })}
            </div>
            {vaultLine && (
              <p className="text-[11px] text-slate-600 mt-0.5 truncate">{vaultLine}</p>
            )}
            {(tx.recurringIncome || tx.subscription || tx.plannedExpense || tx.liability) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {tx.recurringIncome && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">
                    ↻ {tx.recurringIncome.name}
                  </span>
                )}
                {tx.subscription && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                    ↻ {tx.subscription.name}
                  </span>
                )}
                {tx.plannedExpense && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                    ↻ {tx.plannedExpense.name}
                  </span>
                )}
                {tx.liability && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25">
                    ↻ {tx.liability.name}
                  </span>
                )}
                <UnlinkControl transactionId={tx.id} />
              </div>
            )}
            {tx.type === "income" && !tx.recurringIncome && tx.toVault && (
              <div className="mt-1">
                <RecurringLinkButton
                  transactionId={tx.id}
                  mode="income"
                  recurringOptions={recurringOptions}
                  subscriptionOptions={[]}
                />
              </div>
            )}
            {tx.type === "expense" &&
              !tx.subscription &&
              !tx.plannedExpense &&
              !tx.liability &&
              tx.fromVault && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <RecurringLinkButton
                  transactionId={tx.id}
                  mode="expense"
                  recurringOptions={[]}
                  subscriptionOptions={subscriptionOptions}
                />
                <PlannedExpenseLinkButton transactionId={tx.id} plannedOptions={plannedOptions} />
                <LiabilityLinkButton transactionId={tx.id} liabilityOptions={liabilityOptions} />
              </div>
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
