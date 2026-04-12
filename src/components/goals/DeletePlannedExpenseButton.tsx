"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePlannedExpense } from "@/app/actions/plannedExpense";

interface DeletePlannedExpenseButtonProps {
  expenseId: string;
}

export function DeletePlannedExpenseButton({ expenseId }: DeletePlannedExpenseButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!window.confirm("Удалить этот запланированный платёж?")) return;
    startTransition(() => {
      void (async () => {
        await deletePlannedExpense(expenseId);
        router.push("/goals?tab=planned");
        router.refresh();
      })();
    });
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="px-3 py-1.5 rounded-md border border-red-500/40 text-red-400 hover:bg-red-600/20 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? "Удаление..." : "Удалить"}
    </button>
  );
}
