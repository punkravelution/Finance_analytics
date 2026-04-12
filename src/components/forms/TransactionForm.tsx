"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { TransactionActionState } from "@/app/actions/transaction";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TRANSACTION_TYPE_LABELS, type TransactionType } from "@/types";

interface VaultOption {
  id: string;
  name: string;
  icon?: string | null;
  balanceSource?: string;
}

interface CategoryOption {
  id: string;
  name: string;
  type: string;
  color?: string | null;
}

interface TransactionFormProps {
  action: (
    prev: TransactionActionState,
    formData: FormData
  ) => Promise<TransactionActionState>;
  vaults: VaultOption[];
  categories: CategoryOption[];
  /** Имена из справочника — клик добавляет тег к операции */
  tagPresets?: string[];
  defaultValues?: {
    type?: string;
    amount?: number;
    date?: string;
    fromVaultId?: string | null;
    toVaultId?: string | null;
    categoryId?: string | null;
    note?: string | null;
    tags?: string[];
    currency?: string;
  };
  cancelHref: string;
  submitLabel?: string;
}

const inputClass =
  "w-full px-3 py-2.5 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors";

export function TransactionForm({
  action,
  vaults,
  categories,
  tagPresets = [],
  defaultValues = {},
  cancelHref,
  submitLabel = "Сохранить",
}: TransactionFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  const [type, setType] = useState(defaultValues.type ?? "");
  const [amount, setAmount] = useState(
    defaultValues.amount != null ? String(defaultValues.amount) : ""
  );
  const [date, setDate] = useState(
    defaultValues.date ?? new Date().toISOString().split("T")[0]
  );
  const [fromVaultId, setFromVaultId] = useState(defaultValues.fromVaultId ?? "");
  const [toVaultId, setToVaultId] = useState(defaultValues.toVaultId ?? "");
  const [categoryId, setCategoryId] = useState(defaultValues.categoryId ?? "");
  const [note, setNote] = useState(defaultValues.note ?? "");
  const [currency, setCurrency] = useState(defaultValues.currency ?? "RUB");
  const [tagList, setTagList] = useState<string[]>(() => {
    if (defaultValues.tags && defaultValues.tags.length > 0) return [...defaultValues.tags];
    return [];
  });
  const [tagInput, setTagInput] = useState("");

  const showFromVault = type === "expense" || type === "transfer";
  const showToVault = type === "income" || type === "transfer";

  const filteredCategories = categories.filter(
    (c) => !type || c.type === type || c.type === "transfer"
  );

  function addTagsFromString(raw: string) {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length === 0) return;
    setTagList((prev) => {
      const next = [...prev];
      for (const p of parts) {
        if (!next.includes(p)) next.push(p);
      }
      return next;
    });
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTagList((prev) => prev.filter((t) => t !== tag));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="tags" value={JSON.stringify(tagList)} readOnly />
      {state.errors?.general && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {state.errors.general}
        </div>
      )}

      {/* Тип */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Тип операции <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(
            Object.entries(TRANSACTION_TYPE_LABELS) as [TransactionType, string][]
          ).map(([val, label]) => (
            <label
              key={val}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${
                type === val
                  ? val === "income"
                    ? "bg-green-500/20 border-green-500/50 text-green-400"
                    : val === "expense"
                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                    : "bg-blue-500/20 border-blue-500/50 text-blue-400"
                  : "bg-[hsl(222,47%,10%)] border-[hsl(216,34%,20%)] text-slate-400 hover:border-[hsl(216,34%,30%)]"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={val}
                checked={type === val}
                onChange={() => {
                  setType(val);
                  setFromVaultId("");
                  setToVaultId("");
                  setCategoryId("");
                }}
                className="sr-only"
              />
              {val === "income" ? "+" : val === "expense" ? "−" : "⇄"} {label}
            </label>
          ))}
        </div>
        {state.errors?.type && (
          <p className="mt-1 text-xs text-red-400">{state.errors.type}</p>
        )}
      </div>

      {/* Сумма и дата */}
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
            placeholder="0.00"
            className={inputClass}
          />
          {state.errors?.amount && (
            <p className="mt-1 text-xs text-red-400">{state.errors.amount}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Дата <span className="text-red-400">*</span>
          </label>
          <input
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputClass} [color-scheme:dark]`}
          />
          {state.errors?.date && (
            <p className="mt-1 text-xs text-red-400">{state.errors.date}</p>
          )}
        </div>
      </div>

      {/* Хранилища (зависит от типа) */}
      {(showFromVault || showToVault) && (
        <div className={showFromVault && showToVault ? "grid grid-cols-2 gap-4" : ""}>
          {showFromVault && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {type === "transfer" ? "Откуда" : "Хранилище"}{" "}
                <span className="text-red-400">*</span>
              </label>
              <select
                name="fromVaultId"
                value={fromVaultId}
                onChange={(e) => setFromVaultId(e.target.value)}
                className={inputClass}
              >
                <option value="">Выберите хранилище…</option>
                {vaults.map((v) => (
                  <option
                    key={v.id}
                    value={v.id}
                    disabled={v.balanceSource === "ASSETS"}
                  >
                    {v.icon ? `${v.icon} ` : ""}
                    {v.name}
                    {v.balanceSource === "ASSETS" ? " (из активов)" : ""}
                  </option>
                ))}
              </select>
              {state.errors?.fromVaultId && (
                <p className="mt-1 text-xs text-red-400">
                  {state.errors.fromVaultId}
                </p>
              )}
            </div>
          )}

          {showToVault && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {type === "transfer" ? "Куда" : "Хранилище"}{" "}
                <span className="text-red-400">*</span>
              </label>
              <select
                name="toVaultId"
                value={toVaultId}
                onChange={(e) => setToVaultId(e.target.value)}
                className={inputClass}
              >
                <option value="">Выберите хранилище…</option>
                {vaults
                  .filter((v) => v.id !== fromVaultId)
                  .map((v) => (
                    <option
                      key={v.id}
                      value={v.id}
                      disabled={v.balanceSource === "ASSETS"}
                    >
                      {v.icon ? `${v.icon} ` : ""}
                      {v.name}
                      {v.balanceSource === "ASSETS" ? " (из активов)" : ""}
                    </option>
                  ))}
              </select>
              {state.errors?.toVaultId && (
                <p className="mt-1 text-xs text-red-400">
                  {state.errors.toVaultId}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Категория */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Категория{" "}
          <span className="text-slate-500 font-normal">(необязательно)</span>
        </label>
        <select
          name="categoryId"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={inputClass}
        >
          <option value="">Без категории</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Теги */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
          <label className="block text-sm font-medium text-slate-300">
            Теги <span className="text-slate-500 font-normal">(через запятую или Enter)</span>
          </label>
          <Link
            href="/settings/categories-tags"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Справочник категорий и тегов
          </Link>
        </div>
        {tagPresets.length > 0 && (
          <div className="mb-2">
            <p className="text-[11px] text-slate-500 mb-1.5">Быстро из справочника:</p>
            <div className="flex flex-wrap gap-1.5">
              {tagPresets.map((t) => {
                const active = tagList.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={active}
                    onClick={() => addTagsFromString(t)}
                    className={`px-2 py-0.5 rounded-md text-xs border transition-colors ${
                      active
                        ? "border-slate-600 text-slate-600 cursor-default"
                        : "border-slate-600 text-slate-300 hover:border-blue-500/50 hover:text-blue-300"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[1.75rem]">
          {tagList.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-600"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded-full p-0.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700"
                aria-label={`Удалить тег ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          value={tagInput}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) {
              addTagsFromString(v.slice(0, -1));
            } else {
              setTagInput(v);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTagsFromString(tagInput);
            }
          }}
          placeholder="Новый тег…"
          className={inputClass}
        />
      </div>

      {/* Валюта и заметка */}
      <div className="grid grid-cols-3 gap-4">
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

        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Заметка{" "}
            <span className="text-slate-500 font-normal">(необязательно)</span>
          </label>
          <Textarea
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Краткое описание операции"
            rows={3}
            className={cn(inputClass, "min-h-[88px] resize-y")}
          />
        </div>
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
