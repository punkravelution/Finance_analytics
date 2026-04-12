"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { updateTransactionCategory } from "@/app/actions/transaction";

export interface CategoryOptionDto {
  id: string;
  name: string;
  type: string;
  color: string | null;
}

interface TransactionCategoryQuickPickProps {
  transactionId: string;
  transactionType: string;
  initialCategoryId: string | null;
  initialCategory: { id: string; name: string; color: string | null } | null;
  categories: CategoryOptionDto[];
}

export function TransactionCategoryQuickPick({
  transactionId,
  transactionType,
  initialCategoryId,
  initialCategory,
  categories,
}: TransactionCategoryQuickPickProps) {
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCategoryId(initialCategoryId);
  }, [initialCategoryId, transactionId]);

  const filtered = useMemo(
    () => categories.filter((c) => c.type === transactionType || c.type === "transfer"),
    [categories, transactionType]
  );

  const active =
    categoryId == null
      ? null
      : (filtered.find((c) => c.id === categoryId) ??
        (initialCategory?.id === categoryId ? initialCategory : null));

  const applyCategory = (nextId: string) => {
    const prev = categoryId;
    const normalized = nextId.trim();
    setCategoryId(normalized.length > 0 ? normalized : null);
    startTransition(async () => {
      try {
        await updateTransactionCategory(transactionId, normalized);
      } catch {
        setCategoryId(prev);
      }
      setPickerOpen(false);
    });
  };

  if (active && !pickerOpen) {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => setPickerOpen(true)}
        className="text-[11px] px-2 py-0.5 rounded-md font-medium transition-opacity hover:opacity-90"
        style={{
          backgroundColor: active.color ? `${active.color}28` : "hsl(216,34%,18%)",
          color: active.color ?? "#94a3b8",
        }}
      >
        {active.name}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {!active && !pickerOpen && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setPickerOpen(true)}
          className="text-[11px] px-2 py-0.5 rounded-md border border-dashed border-slate-600 text-slate-500 hover:border-slate-500 hover:text-slate-400"
        >
          категория?
        </button>
      )}
      {pickerOpen && (
        <select
          disabled={isPending}
          value={categoryId ?? ""}
          onChange={(e) => applyCategory(e.target.value)}
          className="text-[11px] max-w-[220px] rounded-md border border-[hsl(216,34%,25%)] bg-[hsl(222,47%,10%)] text-slate-200 px-2 py-1"
          autoFocus
          onBlur={() => setPickerOpen(false)}
        >
          <option value="">Без категории</option>
          {filtered.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {pickerOpen && active && (
        <button
          type="button"
          className="text-[10px] text-slate-600 hover:text-slate-400"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setPickerOpen(false)}
        >
          закрыть
        </button>
      )}
    </div>
  );
}
