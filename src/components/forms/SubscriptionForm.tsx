"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { SubscriptionActionState } from "@/app/actions/subscription";

interface VaultOption {
  id: string;
  name: string;
  icon?: string | null;
}

interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

interface SubscriptionFormProps {
  action: (
    prev: SubscriptionActionState,
    formData: FormData
  ) => Promise<SubscriptionActionState>;
  vaults: VaultOption[];
  currencies: CurrencyOption[];
  defaultValues?: {
    name?: string;
    amount?: number;
    currency?: string;
    billingPeriod?: string;
    nextChargeDate?: string;
    category?: string;
    vaultId?: string;
    isEssential?: boolean;
    note?: string | null;
  };
  cancelHref: string;
  submitLabel?: string;
}

const inputClass =
  "w-full px-3 py-2.5 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors";

export function SubscriptionForm({
  action,
  vaults,
  currencies,
  defaultValues = {},
  cancelHref,
  submitLabel = "Сохранить",
}: SubscriptionFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [name, setName] = useState(defaultValues.name ?? "");
  const [amount, setAmount] = useState(
    defaultValues.amount != null ? String(defaultValues.amount) : ""
  );
  const [currency, setCurrency] = useState(defaultValues.currency ?? "RUB");
  const [billingPeriod, setBillingPeriod] = useState(
    defaultValues.billingPeriod ?? "monthly"
  );
  const [nextChargeDate, setNextChargeDate] = useState(
    defaultValues.nextChargeDate ?? new Date().toISOString().split("T")[0]
  );
  const [category, setCategory] = useState(defaultValues.category ?? "");
  const [vaultId, setVaultId] = useState(defaultValues.vaultId ?? "");
  const [isEssential, setIsEssential] = useState(defaultValues.isEssential ?? false);
  const [note, setNote] = useState(defaultValues.note ?? "");

  return (
    <form action={formAction} className="space-y-5">
      {state.errors?.general && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {state.errors.general}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Название <span className="text-red-400">*</span>
        </label>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Spotify"
          className={inputClass}
        />
        {state.errors?.name && <p className="mt-1 text-xs text-red-400">{state.errors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Сумма <span className="text-red-400">*</span>
          </label>
          <input
            name="amount"
            type="number"
            step="any"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
          {state.errors?.amount && (
            <p className="mt-1 text-xs text-red-400">{state.errors.amount}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Валюта <span className="text-red-400">*</span>
          </label>
          <select
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={inputClass}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name} ({c.symbol})
              </option>
            ))}
          </select>
          {state.errors?.currency && (
            <p className="mt-1 text-xs text-red-400">{state.errors.currency}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Период <span className="text-red-400">*</span>
          </label>
          <select
            name="billingPeriod"
            value={billingPeriod}
            onChange={(e) => setBillingPeriod(e.target.value)}
            className={inputClass}
          >
            <option value="monthly">Ежемесячно</option>
            <option value="quarterly">Ежеквартально</option>
            <option value="yearly">Ежегодно</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Следующее списание <span className="text-red-400">*</span>
          </label>
          <input
            name="nextChargeDate"
            type="date"
            value={nextChargeDate}
            onChange={(e) => setNextChargeDate(e.target.value)}
            className={`${inputClass} [color-scheme:dark]`}
          />
          {state.errors?.nextChargeDate && (
            <p className="mt-1 text-xs text-red-400">{state.errors.nextChargeDate}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Категория <span className="text-red-400">*</span>
          </label>
          <input
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Например: Связь"
            className={inputClass}
          />
          {state.errors?.category && (
            <p className="mt-1 text-xs text-red-400">{state.errors.category}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Хранилище списания <span className="text-red-400">*</span>
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

      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input
          name="isEssential"
          type="checkbox"
          checked={isEssential}
          onChange={(e) => setIsEssential(e.target.checked)}
          className="w-4 h-4 rounded border-slate-600 accent-blue-500"
        />
        Обязательная подписка
      </label>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Заметка
        </label>
        <textarea
          name="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-[hsl(216,34%,17%)]">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm"
        >
          {isPending ? "Сохранение…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="px-5 py-2.5 text-slate-400 hover:text-slate-200 font-medium text-sm"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
