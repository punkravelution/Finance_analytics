"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { linkTransactionToPlanned } from "@/app/actions/transaction";
import { formatCurrency } from "@/lib/format";

export interface PlannedExpenseOptionDto {
  id: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: Date | null;
}

function formatShortDate(d: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(d));
}

interface PlannedExpenseLinkButtonProps {
  transactionId: string;
  plannedOptions: PlannedExpenseOptionDto[];
}

export function PlannedExpenseLinkButton({
  transactionId,
  plannedOptions,
}: PlannedExpenseLinkButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pick = (plannedExpenseId: string) => {
    setMsg(null);
    startTransition(async () => {
      const r = await linkTransactionToPlanned(transactionId, plannedExpenseId);
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-[10px] text-amber-400/90 hover:text-amber-300 underline underline-offset-2 disabled:opacity-50"
          disabled={pending}
        >
          {pending ? "…" : "привязать к плану"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 overflow-y-auto w-72">
        {msg && <p className="text-xs text-red-400 mb-2">{msg}</p>}
        <ul className="space-y-1">
          {plannedOptions.length === 0 ? (
            <li className="text-xs text-slate-500">Нет неоплаченных запланированных платежей для этого хранилища.</li>
          ) : (
            plannedOptions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-[hsl(216,34%,14%)]"
                  onClick={() => pick(p.id)}
                  disabled={pending}
                >
                  <span className="font-medium text-slate-200">{p.name}</span>
                  <span className="block text-slate-500">
                    {formatCurrency(p.amount, p.currency)} ·{" "}
                    {p.dueDate != null
                      ? `срок ${formatShortDate(p.dueDate)}`
                      : "без даты"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
