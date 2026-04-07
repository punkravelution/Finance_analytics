"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { SellAssetActionState } from "@/app/actions/asset";

interface VaultOption {
  id: string;
  name: string;
  icon?: string | null;
}

interface AssetSellFormProps {
  action: (
    prev: SellAssetActionState,
    formData: FormData
  ) => Promise<SellAssetActionState>;
  vaults: VaultOption[];
  cancelHref: string;
}

const inputClass =
  "w-full px-3 py-2.5 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors";

export function AssetSellForm({ action, vaults, cancelHref }: AssetSellFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [amount, setAmount] = useState("");
  const [toVaultId, setToVaultId] = useState("");
  const [note, setNote] = useState("");

  return (
    <form action={formAction} className="space-y-5">
      {state.errors?.general && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {state.errors.general}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Сумма продажи <span className="text-red-400">*</span>
        </label>
        <input
          name="amount"
          type="number"
          step="any"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className={inputClass}
        />
        {state.errors?.amount && (
          <p className="mt-1 text-xs text-red-400">{state.errors.amount}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Хранилище зачисления <span className="text-red-400">*</span>
        </label>
        <select
          name="toVaultId"
          value={toVaultId}
          onChange={(e) => setToVaultId(e.target.value)}
          className={inputClass}
        >
          <option value="">Выберите денежное хранилище…</option>
          {vaults.map((v) => (
            <option key={v.id} value={v.id}>
              {v.icon ? `${v.icon} ` : ""}
              {v.name}
            </option>
          ))}
        </select>
        {state.errors?.toVaultId && (
          <p className="mt-1 text-xs text-red-400">{state.errors.toVaultId}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Комментарий к продаже
        </label>
        <textarea
          name="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Опционально…"
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-[hsl(216,34%,17%)]">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
        >
          {isPending ? "Выполняется…" : "Подтвердить продажу"}
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
