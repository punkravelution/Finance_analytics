"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  linkTransactionToRecurring,
  linkTransactionToSubscription,
} from "@/app/actions/transaction";
import { formatCurrency } from "@/lib/format";

export interface RecurringOptionDto {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingPeriod: string;
  nextIncomeDate: Date;
}

export interface SubscriptionOptionDto {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingPeriod: string;
  nextChargeDate: Date;
}

const INCOME_PERIOD: Record<string, string> = {
  monthly: "мес.",
  weekly: "нед.",
  yearly: "год",
  biweekly: "2 нед.",
};

const SUB_PERIOD: Record<string, string> = {
  monthly: "мес.",
  quarterly: "кв.",
  yearly: "год",
};

function formatShortDate(d: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(d));
}

interface RecurringLinkButtonProps {
  transactionId: string;
  mode: "income" | "expense";
  recurringOptions: RecurringOptionDto[];
  subscriptionOptions: SubscriptionOptionDto[];
}

export function RecurringLinkButton({
  transactionId,
  mode,
  recurringOptions,
  subscriptionOptions,
}: RecurringLinkButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pickRecurring = (recurringIncomeId: string) => {
    setMsg(null);
    startTransition(async () => {
      const r = await linkTransactionToRecurring(transactionId, recurringIncomeId);
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  };

  const pickSubscription = (subscriptionId: string) => {
    setMsg(null);
    startTransition(async () => {
      const r = await linkTransactionToSubscription(transactionId, subscriptionId);
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  };

  const label = mode === "income" ? "привязать к доходу" : "привязать к подписке";

  const empty =
    mode === "income"
      ? "Нет активных регулярных доходов для этого хранилища."
      : "Нет активных подписок для этого хранилища.";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 disabled:opacity-50"
          disabled={pending}
        >
          {pending ? "…" : label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 overflow-y-auto">
        {msg && <p className="text-xs text-red-400 mb-2">{msg}</p>}
        {mode === "income" && (
          <ul className="space-y-1">
            {recurringOptions.length === 0 ? (
              <li className="text-xs text-slate-500">{empty}</li>
            ) : (
              recurringOptions.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-[hsl(216,34%,14%)]"
                    onClick={() => pickRecurring(r.id)}
                    disabled={pending}
                  >
                    <span className="font-medium text-slate-200">{r.name}</span>
                    <span className="block text-slate-500">
                      {formatCurrency(r.amount, r.currency)} ·{" "}
                      {INCOME_PERIOD[r.billingPeriod] ?? r.billingPeriod} · след.{" "}
                      {formatShortDate(r.nextIncomeDate)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        {mode === "expense" && (
          <ul className="space-y-1">
            {subscriptionOptions.length === 0 ? (
              <li className="text-xs text-slate-500">{empty}</li>
            ) : (
              subscriptionOptions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-[hsl(216,34%,14%)]"
                    onClick={() => pickSubscription(s.id)}
                    disabled={pending}
                  >
                    <span className="font-medium text-slate-200">{s.name}</span>
                    <span className="block text-slate-500">
                      {formatCurrency(s.amount, s.currency)} ·{" "}
                      {SUB_PERIOD[s.billingPeriod] ?? s.billingPeriod} · след.{" "}
                      {formatShortDate(s.nextChargeDate)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
