"use client";

import { useActionState } from "react";
import { upsertExchangeRateAction, type CurrencyActionState } from "@/app/actions/currency";

interface Props {
  currencies: Array<{ code: string; name: string }>;
}

const initialState: CurrencyActionState = {};

const inputClass =
  "w-full px-3 py-2 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";

export function ExchangeRateUpsertForm({ currencies }: Props) {
  const [state, formAction, isPending] = useActionState(upsertExchangeRateAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <select name="fromCurrency" className={inputClass} defaultValue="">
          <option value="" disabled>
            Из валюты
          </option>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>

        <select name="toCurrency" className={inputClass} defaultValue="">
          <option value="" disabled>
            В валюту
          </option>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>

        <input name="rate" type="number" step="any" min="0.0000001" className={inputClass} placeholder="Курс" />

        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg"
        >
          {isPending ? "Сохраняем…" : "Сохранить курс"}
        </button>
      </div>

      {(state.errors?.fromCurrency ||
        state.errors?.toCurrency ||
        state.errors?.rate ||
        state.errors?.general) && (
        <div className="text-xs text-red-400 space-y-0.5">
          {state.errors?.fromCurrency && <p>{state.errors.fromCurrency}</p>}
          {state.errors?.toCurrency && <p>{state.errors.toCurrency}</p>}
          {state.errors?.rate && <p>{state.errors.rate}</p>}
          {state.errors?.general && <p>{state.errors.general}</p>}
        </div>
      )}
    </form>
  );
}
