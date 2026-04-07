"use client";

import { useActionState, useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { createIncomeEvent, type IncomeEventActionState } from "@/app/actions/incomeEvent";
import { INCOME_EVENT_TYPE_LABELS } from "@/types";

interface Props {
  assetId: string;
  vaultId: string;
  defaultCurrency: string;
}

const INCOME_TYPES = Object.entries(INCOME_EVENT_TYPE_LABELS) as [
  string,
  string
][];

const initialState: IncomeEventActionState = {};

export function AddIncomeEventForm({ assetId, vaultId, defaultCurrency }: Props) {
  const [open, setOpen] = useState(false);

  const action = createIncomeEvent.bind(null, assetId, vaultId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.success && open) setOpen(false);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Plus size={13} />
          Добавить событие
        </button>
      ) : (
        <form
          action={formAction}
          className="mt-3 p-4 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-xl space-y-3"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-slate-400">Новое доходное событие</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-600 hover:text-slate-400 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Дата *</label>
              <input
                type="date"
                name="date"
                defaultValue={today}
                className="w-full bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,20%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              {state.errors?.date && (
                <p className="text-xs text-red-400 mt-1">{state.errors.date}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Тип *</label>
              <select
                name="incomeType"
                defaultValue=""
                className="w-full bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,20%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="" disabled>
                  Выберите…
                </option>
                {INCOME_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {state.errors?.incomeType && (
                <p className="text-xs text-red-400 mt-1">{state.errors.incomeType}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Сумма *</label>
              <input
                type="number"
                name="amount"
                step="any"
                min="0"
                placeholder="0.00"
                className="w-full bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,20%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              {state.errors?.amount && (
                <p className="text-xs text-red-400 mt-1">{state.errors.amount}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Валюта</label>
              <input
                type="text"
                name="currency"
                defaultValue={defaultCurrency}
                maxLength={3}
                className="w-full bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,20%)] rounded-lg px-3 py-2 text-sm text-white uppercase focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Примечание</label>
            <input
              type="text"
              name="note"
              placeholder="Необязательно"
              className="w-full bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,20%)] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          {state.errors?.general && (
            <p className="text-xs text-red-400">{state.errors.general}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
