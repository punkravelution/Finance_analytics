"use client";

import { useActionState } from "react";
import { updateCurrency, type CurrencyActionState } from "@/app/actions/currency";

interface Props {
  currency: {
    code: string;
    name: string;
    symbol: string;
    isActive: boolean;
    sortOrder: number;
  };
}

const initialState: CurrencyActionState = {};

const inputClass =
  "w-full px-3 py-2 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";

export function CurrencyEditForm({ currency }: Props) {
  const action = updateCurrency.bind(null, currency.code);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm text-slate-400 mb-1">Код</label>
        <input value={currency.code} disabled className={`${inputClass} opacity-60`} />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Название</label>
        <input name="name" defaultValue={currency.name} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Символ</label>
        <input name="symbol" defaultValue={currency.symbol} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Порядок</label>
        <input
          name="sortOrder"
          type="number"
          defaultValue={currency.sortOrder}
          className={inputClass}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={currency.isActive}
          className="w-4 h-4 accent-blue-500"
        />
        Активна
      </label>

      {state.errors?.general && <p className="text-xs text-red-400">{state.errors.general}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg"
      >
        {isPending ? "Сохраняем…" : "Сохранить"}
      </button>
    </form>
  );
}
