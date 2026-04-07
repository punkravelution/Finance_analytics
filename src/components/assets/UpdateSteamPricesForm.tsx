"use client";

import { useActionState } from "react";
import { updateSteamPrices, type UpdateSteamPricesResult } from "@/app/actions/asset";

const initialState: UpdateSteamPricesResult = { updated: 0, failed: 0 };

export function UpdateSteamPricesForm() {
  const [state, formAction, isPending] = useActionState(updateSteamPrices, initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {isPending ? "Обновляем..." : "Обновить цены Steam"}
      </button>
      {!isPending && (state.updated > 0 || state.failed > 0) && (
        <p className="text-xs text-slate-400">
          Обновлено: {state.updated} · Ошибок: {state.failed}
        </p>
      )}
    </form>
  );
}
