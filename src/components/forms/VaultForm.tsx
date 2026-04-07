"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { VaultActionState } from "@/app/actions/vault";
import {
  VAULT_TYPE_LABELS,
  LIQUIDITY_LABELS,
  RISK_LABELS,
  type VaultType,
  type LiquidityLevel,
  type RiskLevel,
} from "@/types";

interface VaultFormProps {
  action: (
    prev: VaultActionState,
    formData: FormData
  ) => Promise<VaultActionState>;
  defaultValues?: {
    name?: string;
    type?: string;
    currency?: string;
    liquidityLevel?: string;
    riskLevel?: string;
    includeInNetWorth?: boolean;
    includeInSpendableBalance?: boolean;
    includeInLiquidCapital?: boolean;
    notes?: string;
  };
  cancelHref: string;
  submitLabel?: string;
}

const inputClass =
  "w-full px-3 py-2.5 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors";

export function VaultForm({
  action,
  defaultValues = {},
  cancelHref,
  submitLabel = "Сохранить",
}: VaultFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  const [name, setName] = useState(defaultValues.name ?? "");
  const [type, setType] = useState(defaultValues.type ?? "");
  const [currency, setCurrency] = useState(defaultValues.currency ?? "RUB");
  const [liquidityLevel, setLiquidityLevel] = useState(
    defaultValues.liquidityLevel ?? "medium"
  );
  const [riskLevel, setRiskLevel] = useState(defaultValues.riskLevel ?? "low");
  const [includeInNetWorth, setIncludeInNetWorth] = useState(
    defaultValues.includeInNetWorth !== false
  );
  const [includeInSpendableBalance, setIncludeInSpendableBalance] = useState(
    defaultValues.includeInSpendableBalance !== false
  );
  const [includeInLiquidCapital, setIncludeInLiquidCapital] = useState(
    defaultValues.includeInLiquidCapital !== false
  );
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
          placeholder="Например: Сбербанк, Наличные рубли"
          className={inputClass}
        />
        {state.errors?.name && (
          <p className="mt-1 text-xs text-red-400">{state.errors.name}</p>
        )}
      </div>

      {/* Тип */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Тип <span className="text-red-400">*</span>
        </label>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Выберите тип…
          </option>
          {(Object.entries(VAULT_TYPE_LABELS) as [VaultType, string][]).map(
            ([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            )
          )}
        </select>
        {state.errors?.type && (
          <p className="mt-1 text-xs text-red-400">{state.errors.type}</p>
        )}
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

      {/* Ликвидность и риск */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Ликвидность
          </label>
          <select
            name="liquidityLevel"
            value={liquidityLevel}
            onChange={(e) => setLiquidityLevel(e.target.value)}
            className={inputClass}
          >
            {(Object.entries(LIQUIDITY_LABELS) as [LiquidityLevel, string][]).map(
              ([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Уровень риска
          </label>
          <select
            name="riskLevel"
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value)}
            className={inputClass}
          >
            {(Object.entries(RISK_LABELS) as [RiskLevel, string][]).map(
              ([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* Режимы участия в балансе */}
      <div className="space-y-2.5">
        <p className="text-sm font-medium text-slate-400">Режимы баланса</p>
        <div className="flex items-center gap-3">
          <input
            name="includeInSpendableBalance"
            type="checkbox"
            id="includeInSpendableBalance"
            checked={includeInSpendableBalance}
            onChange={(e) => setIncludeInSpendableBalance(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 accent-blue-500"
          />
          <label htmlFor="includeInSpendableBalance" className="text-sm text-slate-300">
            Доступный баланс{" "}
            <span className="text-slate-500 text-xs">(банк, наличные — средства к трате)</span>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            name="includeInLiquidCapital"
            type="checkbox"
            id="includeInLiquidCapital"
            checked={includeInLiquidCapital}
            onChange={(e) => setIncludeInLiquidCapital(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 accent-blue-500"
          />
          <label htmlFor="includeInLiquidCapital" className="text-sm text-slate-300">
            Ликвидный капитал{" "}
            <span className="text-slate-500 text-xs">(можно конвертировать в деньги)</span>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            name="includeInNetWorth"
            type="checkbox"
            id="includeInNetWorth"
            checked={includeInNetWorth}
            onChange={(e) => setIncludeInNetWorth(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 accent-blue-500"
          />
          <label htmlFor="includeInNetWorth" className="text-sm text-slate-300">
            Общий капитал{" "}
            <span className="text-slate-500 text-xs">(учитывать в суммарном net worth)</span>
          </label>
        </div>
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
