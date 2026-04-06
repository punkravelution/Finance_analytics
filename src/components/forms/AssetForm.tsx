"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { AssetActionState } from "@/app/actions/asset";
import { ASSET_TYPE_LABELS, type AssetType } from "@/types";

interface VaultOption {
  id: string;
  name: string;
  icon?: string | null;
}

interface AssetFormProps {
  action: (
    prev: AssetActionState,
    formData: FormData
  ) => Promise<AssetActionState>;
  vaults: VaultOption[];
  defaultValues?: {
    name?: string;
    assetType?: string;
    vaultId?: string;
    ticker?: string | null;
    quantity?: number;
    unit?: string;
    averageBuyPrice?: number | null;
    currentUnitPrice?: number | null;
    currency?: string;
    notes?: string | null;
  };
  cancelHref: string;
  submitLabel?: string;
}

const inputClass =
  "w-full px-3 py-2.5 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors";

export function AssetForm({
  action,
  vaults,
  defaultValues = {},
  cancelHref,
  submitLabel = "Сохранить",
}: AssetFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  const [name, setName] = useState(defaultValues.name ?? "");
  const [assetType, setAssetType] = useState(defaultValues.assetType ?? "");
  const [vaultId, setVaultId] = useState(defaultValues.vaultId ?? "");
  const [ticker, setTicker] = useState(defaultValues.ticker ?? "");
  const [quantity, setQuantity] = useState(
    defaultValues.quantity != null ? String(defaultValues.quantity) : ""
  );
  const [unit, setUnit] = useState(defaultValues.unit ?? "шт");
  const [averageBuyPrice, setAverageBuyPrice] = useState(
    defaultValues.averageBuyPrice != null
      ? String(defaultValues.averageBuyPrice)
      : ""
  );
  const [currentUnitPrice, setCurrentUnitPrice] = useState(
    defaultValues.currentUnitPrice != null
      ? String(defaultValues.currentUnitPrice)
      : ""
  );
  const [currency, setCurrency] = useState(defaultValues.currency ?? "RUB");
  const [notes, setNotes] = useState(defaultValues.notes ?? "");

  return (
    <form action={formAction} className="space-y-5">
      {state.errors?.general && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {state.errors.general}
        </div>
      )}

      {/* Название */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Название <span className="text-red-400">*</span>
        </label>
        <input
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Сбербанк, Bitcoin, ОФЗ 26238"
          className={inputClass}
        />
        {state.errors?.name && (
          <p className="mt-1 text-xs text-red-400">{state.errors.name}</p>
        )}
      </div>

      {/* Тип и хранилище */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Тип актива <span className="text-red-400">*</span>
          </label>
          <select
            name="assetType"
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Выберите тип…
            </option>
            {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(
              ([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              )
            )}
          </select>
          {state.errors?.assetType && (
            <p className="mt-1 text-xs text-red-400">{state.errors.assetType}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Хранилище <span className="text-red-400">*</span>
          </label>
          <select
            name="vaultId"
            value={vaultId}
            onChange={(e) => setVaultId(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Выберите хранилище…
            </option>
            {vaults.map((v) => (
              <option key={v.id} value={v.id}>
                {v.icon ? `${v.icon} ` : ""}
                {v.name}
              </option>
            ))}
          </select>
          {state.errors?.vaultId && (
            <p className="mt-1 text-xs text-red-400">{state.errors.vaultId}</p>
          )}
        </div>
      </div>

      {/* Тикер */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Тикер / символ{" "}
          <span className="text-slate-500 font-normal">(необязательно)</span>
        </label>
        <input
          name="ticker"
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Например: SBER, BTC, LKOH"
          className={inputClass}
        />
      </div>

      {/* Количество и единица */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Количество <span className="text-red-400">*</span>
          </label>
          <input
            name="quantity"
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
          {state.errors?.quantity && (
            <p className="mt-1 text-xs text-red-400">{state.errors.quantity}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Единица
          </label>
          <input
            name="unit"
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="шт"
            className={inputClass}
          />
        </div>
      </div>

      {/* Цены */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Средняя цена покупки{" "}
            <span className="text-slate-500 font-normal">(необязательно)</span>
          </label>
          <input
            name="averageBuyPrice"
            type="number"
            step="any"
            min="0"
            value={averageBuyPrice}
            onChange={(e) => setAverageBuyPrice(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Текущая цена за единицу{" "}
            <span className="text-slate-500 font-normal">(необязательно)</span>
          </label>
          <input
            name="currentUnitPrice"
            type="number"
            step="any"
            min="0"
            value={currentUnitPrice}
            onChange={(e) => setCurrentUnitPrice(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
      </div>

      {/* Валюта */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Валюта
        </label>
        <input
          name="currency"
          type="text"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          placeholder="RUB"
          maxLength={10}
          className={inputClass}
        />
      </div>

      {/* Заметки */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Заметки
        </label>
        <textarea
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Опционально…"
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Кнопки */}
      <div className="flex items-center gap-3 pt-2 border-t border-[hsl(216,34%,17%)]">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
        >
          {isPending ? "Сохранение…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="px-5 py-2.5 text-slate-400 hover:text-slate-200 font-medium text-sm transition-colors"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
