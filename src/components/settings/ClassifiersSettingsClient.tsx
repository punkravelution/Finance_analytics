"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createCategoryAction, deleteCategory } from "@/app/actions/category";
import { createTagPresetAction, deleteTagPreset } from "@/app/actions/tagPreset";
import { upsertCategoryBudget } from "@/app/actions/categoryBudget";
import { TRANSACTION_TYPE_LABELS, type TransactionType } from "@/types";

const inputClass =
  "w-full px-3 py-2.5 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors";

export interface ClassifierCategoryRow {
  id: string;
  name: string;
  type: string;
  color: string | null;
  icon: string | null;
  transactionCount: number;
  budgetLimit: number | null;
  spentThisMonth: number;
}

interface Props {
  categories: ClassifierCategoryRow[];
  tagPresets: { id: string; name: string }[];
  baseCurrency: string;
}

function typeLabel(type: string): string {
  const t = type as TransactionType;
  return TRANSACTION_TYPE_LABELS[t] ?? type;
}

function DeleteCategoryButton({
  id,
  disabled,
  label,
}: {
  id: string;
  disabled: boolean;
  label: string;
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      {err && <p className="text-[10px] text-red-400 max-w-[140px] text-right">{err}</p>}
      <button
        type="button"
        disabled={disabled || pending}
        title={disabled ? "Сначала снимите категорию с операций" : `Удалить «${label}»`}
        onClick={() => {
          setErr(null);
          start(async () => {
            const r = await deleteCategory(id);
            if (r.error) setErr(r.error);
            else router.refresh();
          });
        }}
        className="text-xs text-red-400/90 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? "…" : "Удалить"}
      </button>
    </div>
  );
}

function DeleteTagButton({ id }: { id: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      {err && <p className="text-[10px] text-red-400">{err}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setErr(null);
          start(async () => {
            const r = await deleteTagPreset(id);
            if (r.error) setErr(r.error);
            else router.refresh();
          });
        }}
        className="text-xs text-red-400/90 hover:text-red-300 disabled:opacity-50"
      >
        {pending ? "…" : "×"}
      </button>
    </div>
  );
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === "RUB" ? 0 : 2,
  }).format(value);
}

function CategoryBudgetCell({
  categoryId,
  budgetLimit,
}: {
  categoryId: string;
  budgetLimit: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState(budgetLimit != null ? String(budgetLimit) : "");
  return (
    <div className="flex items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="лимит"
        className="w-24 rounded-md border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,10%)] px-2 py-1 text-xs text-white"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("limit", draft);
            await upsertCategoryBudget(categoryId, fd);
            router.refresh();
          })
        }
        className="rounded-md bg-blue-600 px-2 py-1 text-[11px] text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {pending ? "..." : "Сохранить"}
      </button>
    </div>
  );
}

export function ClassifiersSettingsClient({ categories, tagPresets, baseCurrency }: Props) {
  const router = useRouter();
  const [catState, catAction, catPending] = useActionState(createCategoryAction, {});
  const [tagState, tagAction, tagPending] = useActionState(createTagPresetAction, {});
  const catFormRef = useRef<HTMLFormElement>(null);
  const tagFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (catState.success) {
      catFormRef.current?.reset();
      router.refresh();
    }
  }, [catState.success, router]);

  useEffect(() => {
    if (tagState.success) {
      tagFormRef.current?.reset();
      router.refresh();
    }
  }, [tagState.success, router]);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Категории операций</h2>
          <p className="text-sm text-slate-500 mt-1">
            Категории выбираются при создании операции и в списке операций. Тип должен совпадать с
            типом операции (или «перевод» для любых).
          </p>
        </div>

        <form ref={catFormRef} action={catAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Название</label>
            <input name="name" required maxLength={80} placeholder="Например: Спорт" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Тип</label>
            <select name="type" className={inputClass} defaultValue="expense">
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
              <option value="transfer">Перевод</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Цвет (#RRGGBB)</label>
            <input name="color" placeholder="#94a3b8" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Иконка (эмодзи)</label>
            <input name="icon" maxLength={8} placeholder="🏷️" className={inputClass} />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={catPending}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg"
            >
              {catPending ? "Добавляем…" : "Добавить категорию"}
            </button>
          </div>
        </form>
        {catState.error && <p className="text-sm text-red-400">{catState.error}</p>}

        <div className="rounded-xl border border-[hsl(216,34%,17%)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(222,47%,8%)] text-slate-500 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Название</th>
                <th className="px-3 py-2 font-medium">Тип</th>
                <th className="px-3 py-2 font-medium">Бюджет / мес</th>
                <th className="px-3 py-2 font-medium">Прогресс</th>
                <th className="px-3 py-2 font-medium">Операций</th>
                <th className="px-3 py-2 font-medium w-24" />
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    Категорий пока нет
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id} className="border-t border-[hsl(216,34%,14%)]">
                    <td className="px-3 py-2.5 text-slate-200">
                      <span className="inline-flex items-center gap-2">
                        {c.icon ? <span className="text-base leading-none">{c.icon}</span> : null}
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: c.color ?? "#475569" }}
                          aria-hidden
                        />
                        {c.name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{typeLabel(c.type)}</td>
                    <td className="px-3 py-2.5">
                      <CategoryBudgetCell categoryId={c.id} budgetLimit={c.budgetLimit} />
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {c.budgetLimit != null && c.budgetLimit > 0 ? (
                        <div className="space-y-1">
                          <p className="text-slate-300">
                            {formatMoney(c.spentThisMonth, baseCurrency)} / {formatMoney(c.budgetLimit, baseCurrency)}
                          </p>
                          <p
                            className={
                              c.spentThisMonth <= c.budgetLimit
                                ? "text-emerald-400"
                                : "text-amber-300"
                            }
                          >
                            {((c.spentThisMonth / c.budgetLimit) * 100).toFixed(0)}%
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 tabular-nums">{c.transactionCount}</td>
                    <td className="px-3 py-2.5 text-right">
                      <DeleteCategoryButton
                        id={c.id}
                        disabled={c.transactionCount > 0}
                        label={c.name}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Теги (справочник)</h2>
          <p className="text-sm text-slate-500 mt-1">
            Здесь задаются часто используемые теги. В форме операции их можно добавить одним
            нажатием; также по-прежнему можно ввести любой новый тег вручную.
          </p>
        </div>

        <form ref={tagFormRef} action={tagAction} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-400 mb-1">Название тега</label>
            <input name="name" required maxLength={64} placeholder="например: отпуск" className={inputClass} />
          </div>
          <button
            type="submit"
            disabled={tagPending}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg shrink-0"
          >
            {tagPending ? "Добавляем…" : "Добавить в справочник"}
          </button>
        </form>
        {tagState.error && <p className="text-sm text-red-400">{tagState.error}</p>}

        <ul className="flex flex-wrap gap-2">
          {tagPresets.length === 0 ? (
            <li className="text-sm text-slate-500">Пока нет сохранённых тегов</li>
          ) : (
            tagPresets.map((t) => (
              <li
                key={t.id}
                className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] text-sm text-slate-300"
              >
                <span>{t.name}</span>
                <DeleteTagButton id={t.id} />
              </li>
            ))
          )}
        </ul>
      </section>

      <p className="text-sm text-slate-500">
        <Link href="/transactions/new" className="text-blue-400 hover:text-blue-300">
          Создать операцию →
        </Link>
      </p>
    </div>
  );
}
