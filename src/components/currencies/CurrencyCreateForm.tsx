"use client";

import { useActionState } from "react";
import { createCurrency, type CurrencyActionState } from "@/app/actions/currency";

const initialState: CurrencyActionState = {};

const inputClass =
  "w-full px-3 py-2 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";

export function CurrencyCreateForm() {
  const [state, formAction, isPending] = useActionState(createCurrency, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input name="code" placeholder="Код (RUB)" className={inputClass} maxLength={3} />
        <input name="name" placeholder="Название" className={inputClass} />
        <input name="symbol" placeholder="Символ" className={inputClass} />
        <input name="sortOrder" placeholder="Порядок" defaultValue="0" className={inputClass} />
      </div>

      {(state.errors?.code || state.errors?.name || state.errors?.symbol || state.errors?.general) && (
        <div className="text-xs text-red-400 space-y-0.5">
          {state.errors?.code && <p>{state.errors.code}</p>}
          {state.errors?.name && <p>{state.errors.name}</p>}
          {state.errors?.symbol && <p>{state.errors.symbol}</p>}
          {state.errors?.general && <p>{state.errors.general}</p>}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg"
      >
        {isPending ? "Сохраняем…" : "Добавить валюту"}
      </button>
    </form>
  );
}
