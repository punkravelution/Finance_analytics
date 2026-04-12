"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPlannedExpensePaid } from "@/app/actions/plannedExpense";
import { Button } from "@/components/ui/button";

interface MarkPlannedPaidButtonProps {
  expenseId: string;
  disabled?: boolean;
}

export function MarkPlannedPaidButton({ expenseId, disabled }: MarkPlannedPaidButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      void (async () => {
        await markPlannedExpensePaid(expenseId);
        router.refresh();
      })();
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || isPending}
      onClick={handleClick}
    >
      {isPending ? "…" : "Отметить оплаченным"}
    </Button>
  );
}
