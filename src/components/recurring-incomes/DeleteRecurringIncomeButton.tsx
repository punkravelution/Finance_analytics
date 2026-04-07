"use client";

import { useTransition } from "react";

interface DeleteRecurringIncomeButtonProps {
  action: () => Promise<unknown>;
}

export function DeleteRecurringIncomeButton({ action }: DeleteRecurringIncomeButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!window.confirm("Удалить этот регулярный доход?")) return;

    startTransition(() => {
      void action();
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
