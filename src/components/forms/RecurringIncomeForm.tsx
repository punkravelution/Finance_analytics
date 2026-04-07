"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { CreateRecurringIncomeInput } from "@/types";

type RecurringIncome = CreateRecurringIncomeInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

interface RecurringIncomeFormProps {
  vaults: { id: string; name: string; currency: string }[];
  initialData?: RecurringIncome;
  onSubmit: (data: CreateRecurringIncomeInput) => Promise<unknown>;
}

type FormErrors = {
  name?: string;
  amount?: string;
  vaultId?: string;
  general?: string;
};

const inputClass =
  "w-full px-3 py-2.5 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors";

const CATEGORY_OPTIONS: Array<{
  value: CreateRecurringIncomeInput["category"];
  label: string;
}> = [
  { value: "salary", label: "Зарплата" },
  { value: "freelance", label: "Фриланс" },
  { value: "rental", label: "Аренда" },
  { value: "pension", label: "Пенсия/соцвыплаты" },
  { value: "business", label: "Бизнес" },
  { value: "other", label: "Прочее" },
];

const BILLING_PERIOD_OPTIONS: Array<{
  value: CreateRecurringIncomeInput["billingPeriod"];
  label: string;
}> = [
  { value: "monthly", label: "Ежемесячно" },
  { value: "weekly", label: "Еженедельно" },
  { value: "biweekly", label: "Раз в две недели" },
  { value: "yearly", label: "Ежегодно" },
];

function toDateInputValue(value: Date): string {
  return value.toISOString().split("T")[0];
}

export function RecurringIncomeForm({
  vaults,
  initialData,
  onSubmit,
}: RecurringIncomeFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [category, setCategory] = useState<CreateRecurringIncomeInput["category"]>(
    initialData?.category ?? "salary"
  );
  const [amount, setAmount] = useState(
    initialData != null ? String(initialData.amount) : ""
  );
  const [currency, setCurrency] = useState(
    initialData?.currency ?? vaults[0]?.currency ?? "RUB"
  );
  const [billingPeriod, setBillingPeriod] = useState<CreateRecurringIncomeInput["billingPeriod"]>(
    initialData?.billingPeriod ?? "monthly"
  );
  const [nextIncomeDate, setNextIncomeDate] = useState(
    initialData?.nextIncomeDate
      ? toDateInputValue(initialData.nextIncomeDate)
      : toDateInputValue(new Date())
  );
  const [vaultId, setVaultId] = useState(initialData?.vaultId ?? "");
  const [note, setNote] = useState(initialData?.note ?? "");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
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
    if (!vaultId) {
      nextErrors.vaultId = "Выберите хранилище";
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
        billingPeriod,
        nextIncomeDate: new Date(nextIncomeDate),
        vaultId,
        note: note.trim() ? note.trim() : undefined,
        isActive,
      });
    } catch {
      setErrors({ general: "Не удалось сохранить доход. Попробуйте ещё раз." });
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
              placeholder="Например: Зарплата"
              className={inputClass}
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Категория
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CreateRecurringIncomeInput["category"])}
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
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Период</label>
              <select
                value={billingPeriod}
                onChange={(e) =>
                  setBillingPeriod(e.target.value as CreateRecurringIncomeInput["billingPeriod"])
                }
                className={inputClass}
              >
                {BILLING_PERIOD_OPTIONS.map((option) => (
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
                Дата следующего поступления
              </label>
              <input
                type="date"
                value={nextIncomeDate}
                onChange={(e) => setNextIncomeDate(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Зачислять в хранилище <span className="text-red-400">*</span>
              </label>
              <select
                value={vaultId}
                onChange={(e) => setVaultId(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  Выберите хранилище...
                </option>
                {vaults.map((vault) => (
                  <option key={vault.id} value={vault.id}>
                    {vault.name} ({vault.currency})
                  </option>
                ))}
              </select>
              {errors.vaultId && <p className="mt-1 text-xs text-red-400">{errors.vaultId}</p>}
            </div>
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

          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 accent-blue-500"
            />
            Активен
          </label>

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
