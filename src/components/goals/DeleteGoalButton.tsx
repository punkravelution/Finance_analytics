"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGoal } from "@/app/actions/goal";

interface DeleteGoalButtonProps {
  goalId: string;
}

export function DeleteGoalButton({ goalId }: DeleteGoalButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!window.confirm("Удалить эту цель?")) return;
    startTransition(() => {
      void (async () => {
        await deleteGoal(goalId);
        router.push("/goals");
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
