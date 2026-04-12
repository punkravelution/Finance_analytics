"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import type { CreateGoalInput, GoalCategory, GoalPriority } from "@/types";

type GoalRow = CreateGoalInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

interface GoalFormProps {
  vaults: { id: string; name: string; currency: string }[];
  initialData?: GoalRow;
  onSubmit: (data: CreateGoalInput) => Promise<unknown>;
}

type FormErrors = {
  name?: string;
  targetAmount?: string;
  currentAmount?: string;
  general?: string;
};

const inputClass =
  "w-full px-3 py-2.5 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors";

const CATEGORY_OPTIONS: Array<{ value: GoalCategory; label: string }> = [
  { value: "gadget", label: "Гаджеты" },
  { value: "travel", label: "Путешествия" },
  { value: "education", label: "Образование" },
  { value: "realty", label: "Недвижимость" },
  { value: "emergency", label: "Подушка безопасности" },
  { value: "other", label: "Другое" },
];

const PRIORITY_OPTIONS: Array<{ value: GoalPriority; label: string }> = [
  { value: "high", label: "Высокий" },
  { value: "medium", label: "Средний" },
  { value: "low", label: "Низкий" },
];

function toDateInputValue(value: Date): string {
  return value.toISOString().split("T")[0];
}

export function GoalForm({ vaults, initialData, onSubmit }: GoalFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name ?? "");
  const [category, setCategory] = useState<GoalCategory>(initialData?.category ?? "other");
  const [priority, setPriority] = useState<GoalPriority>(initialData?.priority ?? "medium");
  const [targetAmount, setTargetAmount] = useState(
    initialData != null ? String(initialData.targetAmount) : ""
  );
  const [currentAmount, setCurrentAmount] = useState(
    initialData != null ? String(initialData.currentAmount) : "0"
  );
  const [currency, setCurrency] = useState(
    initialData?.currency ?? vaults[0]?.currency ?? "RUB"
  );
  const [targetDate, setTargetDate] = useState(
    initialData?.targetDate ? toDateInputValue(initialData.targetDate) : ""
  );
  const [vaultId, setVaultId] = useState(initialData?.vaultId ?? "");
  const [note, setNote] = useState(initialData?.note ?? "");
  const [isCompleted, setIsCompleted] = useState(initialData?.isCompleted ?? false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currencyOptions = useMemo(() => {
    const fromVaults = vaults.map((vault) => vault.currency.toUpperCase().trim());
    const fallback = ["RUB", "USD", "EUR", "USDT"];
    return Array.from(new Set([...fromVaults, ...fallback]));
  }, [vaults]);

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    const parsedTarget = Number(targetAmount);
    const parsedCurrent = Number(currentAmount);

    if (!name.trim()) {
      nextErrors.name = "Введите название";
    }
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      nextErrors.targetAmount = "Целевая сумма должна быть больше 0";
    }
    if (!Number.isFinite(parsedCurrent) || parsedCurrent < 0) {
      nextErrors.currentAmount = "Текущая сумма не может быть отрицательной";
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
      const parsedTarget = Number(targetAmount);
      const parsedCurrent = Number(currentAmount);
      await onSubmit({
        name: name.trim(),
        category,
        priority,
        targetAmount: parsedTarget,
        currentAmount: parsedCurrent,
        currency,
        targetDate: targetDate ? new Date(targetDate) : null,
        vaultId: vaultId.trim() ? vaultId : null,
        note: note.trim() ? note.trim() : null,
        isCompleted,
      });
      router.push("/goals");
      router.refresh();
    } catch {
      setErrors({ general: "Не удалось сохранить цель. Попробуйте ещё раз." });
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
              placeholder="Например: MacBook Pro"
              className={inputClass}
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Категория</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as GoalCategory)}
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
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Приоритет</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as GoalPriority)}
                className={inputClass}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Целевая сумма <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className={inputClass}
              />
              {errors.targetAmount && (
                <p className="mt-1 text-xs text-red-400">{errors.targetAmount}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Уже отложено
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className={inputClass}
              />
              {errors.currentAmount && (
                <p className="mt-1 text-xs text-red-400">{errors.currentAmount}</p>
              )}
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
                Желаемая дата
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Хранилище</label>
            <select
              value={vaultId}
              onChange={(e) => setVaultId(e.target.value)}
              className={inputClass}
            >
              <option value="">Не привязано</option>
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
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 accent-blue-500"
              />
              Цель достигнута
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
