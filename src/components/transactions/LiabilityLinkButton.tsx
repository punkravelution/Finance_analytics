"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { linkTransactionToLiability } from "@/app/actions/transaction";
import { formatCurrency } from "@/lib/format";

export interface LiabilityOptionDto {
  id: string;
  name: string;
  currentBalance: number;
  currency: string;
  minimumPayment: number | null;
  nextPaymentDate: Date | null;
}

function formatShortDate(d: Date | string | null): string {
  if (d == null) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(d));
}

interface LiabilityLinkButtonProps {
  transactionId: string;
  liabilityOptions: LiabilityOptionDto[];
}

export function LiabilityLinkButton({ transactionId, liabilityOptions }: LiabilityLinkButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pick = (liabilityId: string) => {
    setMsg(null);
    startTransition(async () => {
      const r = await linkTransactionToLiability(transactionId, liabilityId);
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
          className="text-[10px] text-rose-400/90 hover:text-rose-300 underline underline-offset-2 disabled:opacity-50"
          disabled={pending}
        >
          {pending ? "…" : "привязать к долгу"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 overflow-y-auto w-72">
        {msg && <p className="text-xs text-red-400 mb-2">{msg}</p>}
        <ul className="space-y-1">
          {liabilityOptions.length === 0 ? (
            <li className="text-xs text-slate-500">
              Нет активных долгов с остатком в валюте этой операции.
            </li>
          ) : (
            liabilityOptions.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-[hsl(216,34%,14%)]"
                  onClick={() => pick(l.id)}
                  disabled={pending}
                >
                  <span className="font-medium text-slate-200">{l.name}</span>
                  <span className="block text-slate-500">
                    остаток {formatCurrency(l.currentBalance, l.currency)}
                    {l.minimumPayment != null && l.minimumPayment > 0
                      ? ` · мин. ${formatCurrency(l.minimumPayment, l.currency)}`
                      : ""}
                    {l.nextPaymentDate
                      ? ` · платёж ${formatShortDate(l.nextPaymentDate)}`
                      : ""}
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
