"use client";

import { useActionState, useState } from "react";
import { Pencil, Trash2, X, Loader2, Check } from "lucide-react";
import {
  updateValuation,
  deleteValuation,
  type ValuationActionState,
} from "@/app/actions/valuation";
import { formatCurrency, formatDate } from "@/lib/format";

interface Props {
  assetId: string;
  valuation: {
    id: string;
    date: Date;
    unitPrice: number;
    totalValue: number;
    notes: string | null;
  };
  currency: string;
}

const emptyState: ValuationActionState = {};

export function ValuationRow({ assetId, valuation, currency }: Props) {
  const [editing, setEditing] = useState(false);

  const updateAction = updateValuation.bind(null, assetId, valuation.id);
  const [state, formAction, isPending] = useActionState(updateAction, emptyState);

  if (state.success && editing) setEditing(false);

  const dateValue = valuation.date instanceof Date
    ? valuation.date.toISOString().split("T")[0]
    : String(valuation.date).split("T")[0];

  if (editing) {
    return (
      <div className="py-2.5 px-1 border-b border-[hsl(216,34%,13%)] last:border-0">
        <form action={formAction} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Дата *</label>
              <input
                type="date"
                name="date"
                defaultValue={dateValue}
                className="w-full bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,20%)] rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              {state.errors?.date && (
                <p className="text-[10px] text-red-400 mt-0.5">{state.errors.date}</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">
                Цена за единицу *
              </label>
              <input
                type="number"
                name="unitPrice"
                step="any"
                min="0.000001"
                defaultValue={valuation.unitPrice}
                className="w-full bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,20%)] rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              {state.errors?.unitPrice && (
                <p className="text-[10px] text-red-400 mt-0.5">{state.errors.unitPrice}</p>
              )}
            </div>
          </div>

          <input
            type="text"
            name="notes"
            defaultValue={valuation.notes ?? ""}
            placeholder="Примечание (необязательно)"
            className="w-full bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,20%)] rounded-md px-2 py-1.5 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-blue-500"
          />

          {state.errors?.general && (
            <p className="text-[10px] text-red-400">{state.errors.general}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded-md transition-colors"
            >
              {isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Check size={11} />
              )}
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 px-3 py-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors"
            >
              <X size={11} />
              Отмена
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2.5 px-1 border-b border-[hsl(216,34%,13%)] last:border-0 group">
      <div>
        <span className="text-sm text-slate-400">{formatDate(valuation.date)}</span>
        {valuation.notes && (
          <p className="text-xs text-slate-600 mt-0.5">{valuation.notes}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-300 tabular-nums">
          {formatCurrency(valuation.unitPrice, currency)} / ед. ·{" "}
          <span className="text-white font-medium">
            {formatCurrency(valuation.totalValue, currency)}
          </span>
        </span>

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            title="Редактировать"
            onClick={() => setEditing(true)}
            className="text-slate-600 hover:text-blue-400 transition-colors"
          >
            <Pencil size={12} />
          </button>

          <form action={deleteValuation.bind(null, assetId, valuation.id)}>
            <button
              type="submit"
              title="Удалить"
              className="text-slate-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
