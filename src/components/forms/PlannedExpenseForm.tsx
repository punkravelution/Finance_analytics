"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import type { CreatePlannedExpenseInput, PlannedExpenseCategory } from "@/types";

type PlannedRow = CreatePlannedExpenseInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

interface PlannedExpenseFormProps {
  vaults: { id: string; name: string; currency: string }[];
  initialData?: PlannedRow;
  onSubmit: (data: CreatePlannedExpenseInput) => Promise<unknown>;
}

type FormErrors = {
  name?: string;
  amount?: string;
  dueDate?: string;
  general?: string;
};

const inputClass =
  "w-full px-3 py-2.5 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors";

const CATEGORY_OPTIONS: Array<{ value: PlannedExpenseCategory; label: string }> = [
  { value: "education", label: "Образование" },
  { value: "tax", label: "Налоги" },
  { value: "medical", label: "Медицина" },
  { value: "insurance", label: "Страховки" },
  { value: "subscription", label: "Подписки" },
  { value: "other", label: "Другое" },
];

function toDateInputValue(value: Date): string {
  return value.toISOString().split("T")[0];
}

export function PlannedExpenseForm({ vaults, initialData, onSubmit }: PlannedExpenseFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name ?? "");
  const [category, setCategory] = useState<PlannedExpenseCategory>(
    initialData?.category ?? "other"
  );
  const [amount, setAmount] = useState(initialData != null ? String(initialData.amount) : "");
  const [currency, setCurrency] = useState(
    initialData?.currency ?? vaults[0]?.currency ?? "RUB"
  );
  const [noDueDate, setNoDueDate] = useState(initialData?.dueDate == null);
  const [dueDate, setDueDate] = useState(
    initialData?.dueDate
      ? toDateInputValue(initialData.dueDate)
      : toDateInputValue(new Date())
  );
  const [vaultId, setVaultId] = useState(initialData?.vaultId ?? "");
  const [note, setNote] = useState(initialData?.note ?? "");
  const [isPaid, setIsPaid] = useState(initialData?.isPaid ?? false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currencyOptions = useMemo(() => {
    const fromVaults = vaults.map((vault) => vault.currency.toUpperCase().trim());
    const fallback = ["RUB", "USD", "EUR", "USDT"];
    return Array.from(new Set([...fromVaults, ...fallback]));
  }, [vaults]);

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    const parsedAmount = Number(amount);

    if (!name.trim()) {
      nextErrors.name = "Введите название";
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = "Сумма должна быть больше 0";
    }
    if (!noDueDate && !dueDate) {
      nextErrors.dueDate = "Укажите дату";
    }
    return nextErrors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      await onSubmit({
        name: name.trim(),
        category,
        amount: Number(amount),
        currency,
        dueDate: noDueDate ? null : new Date(dueDate),
        vaultId: vaultId.trim() ? vaultId : null,
        note: note.trim() ? note.trim() : null,
        isPaid,
      });
      router.push("/goals?tab=planned");
      router.refresh();
    } catch {
      setErrors({ general: "Не удалось сохранить платёж. Попробуйте ещё раз." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {errors.general && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {errors.general}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Название <span className="text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Налог на имущество"
              className={inputClass}
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Категория</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PlannedExpenseCategory)}
                className={inputClass}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Сумма <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
              />
              {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Валюта</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputClass}
              >
                {currencyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Дата платежа
                {!noDueDate ? <span className="text-red-400"> *</span> : null}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={noDueDate}
                className={`${inputClass} [color-scheme:dark] disabled:opacity-50 disabled:cursor-not-allowed`}
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noDueDate}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setNoDueDate(on);
                    if (on) setErrors((prev) => ({ ...prev, dueDate: undefined }));
                  }}
                  className="w-4 h-4 rounded border-slate-600 accent-blue-500"
                />
                Нет даты
              </label>
              {errors.dueDate && <p className="mt-1 text-xs text-red-400">{errors.dueDate}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Хранилище</label>
            <select
              value={vaultId}
              onChange={(e) => setVaultId(e.target.value)}
              className={inputClass}
            >
              <option value="">Не указано</option>
              {vaults.map((vault) => (
                <option key={vault.id} value={vault.id}>
                  {vault.name} ({vault.currency})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Заметка</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {initialData && (
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 accent-blue-500"
              />
              Оплачено
            </label>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm"
          >
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
