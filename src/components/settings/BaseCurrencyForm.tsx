"use client";

import { useActionState } from "react";
import { updateBaseCurrencyAction } from "@/app/actions/settings";

interface Props {
  currentCurrency: string;
  supportedCurrencies: ReadonlyArray<{
    code: string;
    label: string;
    symbol: string;
  }>;
}

const initialState: { success?: boolean; error?: string } = {};

export function BaseCurrencyForm({ currentCurrency, supportedCurrencies }: Props) {
  const [state, formAction, isPending] = useActionState(
    updateBaseCurrencyAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {supportedCurrencies.map((c) => (
          <label key={c.code} className="cursor-pointer">
            <input
              type="radio"
              name="baseCurrency"
              value={c.code}
              defaultChecked={c.code === currentCurrency}
              className="sr-only peer"
            />
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[hsl(216,34%,17%)] text-sm text-slate-400 peer-checked:border-blue-500 peer-checked:text-blue-300 peer-checked:bg-blue-500/10 hover:border-[hsl(216,34%,25%)] transition-colors">
              <span className="font-mono text-base leading-none">{c.symbol}</span>
              <span>{c.code}</span>
              <span className="text-xs text-slate-600">{c.label}</span>
            </div>
          </label>
        ))}
      </div>

      {state?.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-green-400">Базовая валюта сохранена</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
      >
        {isPending ? "Сохраняем…" : "Сохранить"}
      </button>
    </form>
  );
}
