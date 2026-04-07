"use client";

import { useActionState } from "react";
import { updateMoexPrices, type UpdateMoexPricesResult } from "@/app/actions/asset";

const initialState: UpdateMoexPricesResult = { updated: 0, failed: 0, errors: [] };

export function UpdateMoexPricesForm() {
  const [state, formAction, isPending] = useActionState(updateMoexPrices, initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {isPending ? "Обновляем..." : "Обновить цены MOEX"}
      </button>
      {!isPending && (state.updated > 0 || state.failed > 0) && (
        <>
          <p className="text-xs text-slate-400">
            Обновлено: {state.updated}, ошибок: {state.failed}
          </p>
          {state.errors.length > 0 && (
            <p className="text-xs text-red-400">
              {state.errors.join(", ")}
            </p>
          )}
        </>
      )}
    </form>
  );
}
