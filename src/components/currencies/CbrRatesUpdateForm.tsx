"use client";

import { useActionState } from "react";
import { triggerRatesUpdate, type RatesUpdateActionState } from "@/app/actions/currency";

const initialState: RatesUpdateActionState = {};

interface Props {
  lastUpdatedLabel: string;
}

export function CbrRatesUpdateForm({ lastUpdatedLabel }: Props) {
  const [state, formAction, isPending] = useActionState(triggerRatesUpdate, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-400">
        Последнее обновление ЦБ РФ: <span className="text-slate-300">{lastUpdatedLabel}</span>
        <span className="block mt-1 text-slate-600">
          Загружаются курсы всех валют из дневного XML ЦБ к рублю (не только USD/EUR).
        </span>
      </div>
      <div className="flex flex-col items-start sm:items-end gap-1">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          {isPending ? "Обновляем…" : "Обновить курсы ЦБ РФ"}
        </button>
        {state.error && <p className="text-sm text-red-400">{state.error}</p>}
        {state.success && (
          <p className="text-sm text-green-400">Курсы обновлены: {state.updated ?? 0}</p>
        )}
      </div>
    </form>
  );
}
