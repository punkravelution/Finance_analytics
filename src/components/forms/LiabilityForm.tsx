"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { LiabilityActionState } from "@/app/actions/liability";

interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

interface LiabilityFormProps {
  action: (
    prev: LiabilityActionState,
    formData: FormData
  ) => Promise<LiabilityActionState>;
  currencies: CurrencyOption[];
  defaultValues?: {
    name?: string;
    type?: string;
    principalAmount?: number;
    currentBalance?: number;
    currency?: string;
    interestRate?: number | null;
    minimumPayment?: number | null;
    nextPaymentDate?: string | null;
    lender?: string | null;
    note?: string | null;
  };
  cancelHref: string;
  submitLabel?: string;
}

const inputClass =
  "w-full px-3 py-2.5 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors";

export function LiabilityForm({
  action,
  currencies,
  defaultValues = {},
  cancelHref,
  submitLabel = "Сохранить",
}: LiabilityFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [name, setName] = useState(defaultValues.name ?? "");
  const [type, setType] = useState(defaultValues.type ?? "");
  const [principalAmount, setPrincipalAmount] = useState(
    defaultValues.principalAmount != null ? String(defaultValues.principalAmount) : ""
  );
  const [currentBalance, setCurrentBalance] = useState(
    defaultValues.currentBalance != null ? String(defaultValues.currentBalance) : ""
  );
  const [currency, setCurrency] = useState(defaultValues.currency ?? "RUB");
  const [interestRate, setInterestRate] = useState(
    defaultValues.interestRate != null ? String(defaultValues.interestRate) : ""
  );
  const [minimumPayment, setMinimumPayment] = useState(
    defaultValues.minimumPayment != null ? String(defaultValues.minimumPayment) : ""
  );
  const [nextPaymentDate, setNextPaymentDate] = useState(
    defaultValues.nextPaymentDate ?? ""
  );
  const [lender, setLender] = useState(defaultValues.lender ?? "");
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
          placeholder="Например: Кредитная карта"
          className={inputClass}
        />
        {state.errors?.name && <p className="mt-1 text-xs text-red-400">{state.errors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Тип <span className="text-red-400">*</span>
          </label>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            <option value="" disabled>
              Выберите тип…
            </option>
            <option value="credit_card">Кредитка</option>
            <option value="installment">Рассрочка</option>
            <option value="loan">Займ</option>
            <option value="other">Другое</option>
          </select>
          {state.errors?.type && <p className="mt-1 text-xs text-red-400">{state.errors.type}</p>}
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
            Исходная сумма <span className="text-red-400">*</span>
          </label>
          <input
            name="principalAmount"
            type="number"
            step="any"
            min="0"
            value={principalAmount}
            onChange={(e) => setPrincipalAmount(e.target.value)}
            className={inputClass}
          />
          {state.errors?.principalAmount && (
            <p className="mt-1 text-xs text-red-400">{state.errors.principalAmount}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Текущий остаток <span className="text-red-400">*</span>
          </label>
          <input
            name="currentBalance"
            type="number"
            step="any"
            min="0"
            value={currentBalance}
            onChange={(e) => setCurrentBalance(e.target.value)}
            className={inputClass}
          />
          {state.errors?.currentBalance && (
            <p className="mt-1 text-xs text-red-400">{state.errors.currentBalance}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Ставка, %
          </label>
          <input
            name="interestRate"
            type="number"
            step="any"
            min="0"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Мин. платёж
          </label>
          <input
            name="minimumPayment"
            type="number"
            step="any"
            min="0"
            value={minimumPayment}
            onChange={(e) => setMinimumPayment(e.target.value)}
            className={inputClass}
          />
          {state.errors?.minimumPayment && (
            <p className="mt-1 text-xs text-red-400">{state.errors.minimumPayment}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Следующий платёж
          </label>
          <input
            name="nextPaymentDate"
            type="date"
            value={nextPaymentDate}
            onChange={(e) => setNextPaymentDate(e.target.value)}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Кредитор
        </label>
        <input
          name="lender"
          value={lender}
          onChange={(e) => setLender(e.target.value)}
          placeholder="Банк / магазин / частное лицо"
          className={inputClass}
        />
      </div>

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
