import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PlannedMonthGroup } from "@/lib/groupPlannedByMonth";
import type { CurrencyTotal } from "@/app/actions/plannedExpense";
import type { PlannedExpenseCategory } from "@/types";
import { MarkPlannedPaidButton } from "./MarkPlannedPaidButton";

const CATEGORY_LABEL: Record<PlannedExpenseCategory, string> = {
  education: "Образование",
  tax: "Налоги",
  medical: "Медицина",
  insurance: "Страховки",
  subscription: "Подписки",
  other: "Другое",
};

const CATEGORY_BADGE: Record<PlannedExpenseCategory, string> = {
  education: "bg-amber-100 text-amber-900 border-amber-200",
  tax: "bg-rose-100 text-rose-900 border-rose-200",
  medical: "bg-pink-100 text-pink-900 border-pink-200",
  insurance: "bg-cyan-100 text-cyan-900 border-cyan-200",
  subscription: "bg-indigo-100 text-indigo-900 border-indigo-200",
  other: "bg-slate-200 text-slate-800 border-slate-300",
};

function categoryKey(value: string): PlannedExpenseCategory {
  const allowed: PlannedExpenseCategory[] = [
    "education",
    "tax",
    "medical",
    "insurance",
    "subscription",
    "other",
  ];
  return allowed.includes(value as PlannedExpenseCategory)
    ? (value as PlannedExpenseCategory)
    : "other";
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isOverdue(due: Date, paid: boolean, now: Date): boolean {
  if (paid) return false;
  return startOfLocalDay(due).getTime() < startOfLocalDay(now).getTime();
}

function capitalizeRu(title: string): string {
  if (!title) return title;
  return title.charAt(0).toLocaleUpperCase("ru-RU") + title.slice(1);
}

export function PlannedPaymentsTab({
  groups,
  threeMonthTotals,
  now,
}: {
  groups: PlannedMonthGroup[];
  threeMonthTotals: CurrencyTotal[];
  now: Date;
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href="/planned-expenses/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
        >
          <Plus size={15} />
          Новый платёж
        </Link>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-slate-400 mb-4">Запланированных платежей пока нет</p>
            <Link
              href="/planned-expenses/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
            >
              <Plus size={15} />
              Добавить платёж
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.sortKey} className="relative pl-6 border-l border-[hsl(216,34%,22%)]">
              <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-[hsl(222,47%,6%)]" />
              <h2 className="text-sm font-semibold text-slate-200 mb-4">
                {capitalizeRu(group.title)}
              </h2>
              <div className="space-y-3">
                {group.items.map((row) => {
                  const overdue = isOverdue(row.dueDate, row.isPaid, now);
                  const cat = categoryKey(row.category);
                  return (
                    <Card
                      key={row.id}
                      className={
                        overdue
                          ? "border-red-500/50 bg-red-950/20"
                          : "border-[hsl(216,34%,17%)]"
                      }
                    >
                      <CardContent className="py-4">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className={`font-medium ${overdue ? "text-red-200" : "text-white"}`}
                              >
                                {row.name}
                              </p>
                              <Badge className={CATEGORY_BADGE[cat]} variant="outline">
                                {CATEGORY_LABEL[cat]}
                              </Badge>
                              {row.isPaid && (
                                <Badge className="bg-green-600/20 text-green-300 border-green-500/40">
                                  Оплачено
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-300">
                              {formatCurrency(row.amount, row.currency)} · {formatDate(row.dueDate)}
                            </p>
                            {row.vault && (
                              <p className="text-xs text-slate-500">Хранилище: {row.vault.name}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <MarkPlannedPaidButton expenseId={row.id} disabled={row.isPaid} />
                            <Link
                              href={`/planned-expenses/${row.id}/edit`}
                              className="px-3 py-1.5 rounded-md border border-slate-500/40 text-slate-300 hover:bg-slate-700/40 transition-colors text-sm"
                            >
                              Редактировать
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)] p-4">
        <p className="text-xs text-slate-500 mb-2">Неоплаченные за ближайшие 3 месяца</p>
        {threeMonthTotals.length === 0 ? (
          <p className="text-sm text-slate-400">Нет начислений в этом окне</p>
        ) : (
          <ul className="space-y-1">
            {threeMonthTotals.map((row) => (
              <li key={row.currency} className="text-lg font-semibold text-white">
                {formatCurrency(row.total, row.currency)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
