"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { VaultRelationActionState } from "@/app/actions/vaultRelation";
import {
  VAULT_RELATION_TYPE_LABELS,
  type VaultRelationType,
} from "@/types";

interface VaultOption {
  id: string;
  name: string;
  icon?: string | null;
}

interface VaultRelationFormProps {
  action: (
    prev: VaultRelationActionState,
    formData: FormData
  ) => Promise<VaultRelationActionState>;
  vaults: VaultOption[];
  defaultValues?: {
    fromVaultId?: string;
    toVaultId?: string;
    relationType?: string;
    strength?: number;
    note?: string;
  };
  cancelHref: string;
  submitLabel?: string;
}

const inputClass =
  "w-full px-3 py-2.5 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors";

export function VaultRelationForm({
  action,
  vaults,
  defaultValues = {},
  cancelHref,
  submitLabel = "Сохранить",
}: VaultRelationFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  const [fromVaultId, setFromVaultId] = useState(
    defaultValues.fromVaultId ?? ""
  );
  const [toVaultId, setToVaultId] = useState(defaultValues.toVaultId ?? "");
  const [relationType, setRelationType] = useState(
    defaultValues.relationType ?? ""
  );
  const [strength, setStrength] = useState(
    String(defaultValues.strength ?? "1")
  );
  const [note, setNote] = useState(defaultValues.note ?? "");

  return (
    <form action={formAction} className="space-y-5">
      {state.errors?.general && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {state.errors.general}
        </div>
      )}

      {/* Источник */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Источник <span className="text-red-400">*</span>
        </label>
        <select
          name="fromVaultId"
          value={fromVaultId}
          onChange={(e) => setFromVaultId(e.target.value)}
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
        {state.errors?.fromVaultId && (
          <p className="mt-1 text-xs text-red-400">{state.errors.fromVaultId}</p>
        )}
      </div>

      {/* Назначение */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Назначение <span className="text-red-400">*</span>
        </label>
        <select
          name="toVaultId"
          value={toVaultId}
          onChange={(e) => setToVaultId(e.target.value)}
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
        {state.errors?.toVaultId && (
          <p className="mt-1 text-xs text-red-400">{state.errors.toVaultId}</p>
        )}
      </div>

      {/* Тип связи */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Тип связи <span className="text-red-400">*</span>
        </label>
        <select
          name="relationType"
          value={relationType}
          onChange={(e) => setRelationType(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Выберите тип…
          </option>
          {(
            Object.entries(VAULT_RELATION_TYPE_LABELS) as [
              VaultRelationType,
              string,
            ][]
          ).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        {state.errors?.relationType && (
          <p className="mt-1 text-xs text-red-400">
            {state.errors.relationType}
          </p>
        )}
      </div>

      {/* Сила связи */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Сила связи{" "}
          <span className="text-slate-500 font-normal text-xs">(больше 0)</span>
        </label>
        <input
          name="strength"
          type="number"
          min="0.01"
          step="0.1"
          value={strength}
          onChange={(e) => setStrength(e.target.value)}
          placeholder="1"
          className={inputClass}
        />
        {state.errors?.strength && (
          <p className="mt-1 text-xs text-red-400">{state.errors.strength}</p>
        )}
      </div>

      {/* Заметка */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Заметка
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
