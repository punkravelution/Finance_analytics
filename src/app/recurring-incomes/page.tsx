import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  deleteRecurringIncome,
  getRecurringIncomes,
  getTotalMonthlyIncome,
} from "@/app/actions/recurringIncome";
import { DeleteRecurringIncomeButton } from "@/components/recurring-incomes/DeleteRecurringIncomeButton";
import type { CreateRecurringIncomeInput } from "@/types";

export const dynamic = "force-dynamic";

type IncomeCategory = CreateRecurringIncomeInput["category"];

const CATEGORY_ORDER: IncomeCategory[] = [
  "salary",
  "freelance",
  "rental",
  "business",
  "pension",
  "other",
];

const CATEGORY_LABEL: Record<IncomeCategory, string> = {
  salary: "Зарплата",
  freelance: "Фриланс",
  rental: "Аренда",
  business: "Бизнес",
  pension: "Пенсия/соцвыплаты",
  other: "Прочее",
};

const CATEGORY_BADGE_CLASS: Record<IncomeCategory, string> = {
  salary: "bg-green-100 text-green-800 border-green-200",
  freelance: "bg-blue-100 text-blue-800 border-blue-200",
  rental: "bg-purple-100 text-purple-800 border-purple-200",
  business: "bg-orange-100 text-orange-800 border-orange-200",
  pension: "bg-slate-200 text-slate-800 border-slate-300",
  other: "bg-slate-200 text-slate-800 border-slate-300",
};

const PERIOD_LABEL: Record<CreateRecurringIncomeInput["billingPeriod"], string> = {
  monthly: "мес",
  weekly: "нед",
  biweekly: "2 нед",
  yearly: "год",
};

export default async function RecurringIncomesPage() {
  const [incomes, totals] = await Promise.all([getRecurringIncomes(), getTotalMonthlyIncome()]);

  const activeCount = incomes.filter((income) => income.isActive).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-2xl font-bold text-white">Регулярные доходы</h1>
        <Link
          href="/recurring-incomes/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
        >
          <Plus size={15} />
          Добавить доход
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">В месяц</p>
          <p className="text-xl font-bold text-white">
            {formatCurrency(totals.totalMonthly, totals.currency)}
          </p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">В год</p>
          <p className="text-xl font-bold text-white">
            {formatCurrency(totals.totalYearly, totals.currency)}
          </p>
        </div>
        <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Источников</p>
          <p className="text-xl font-bold text-white">{activeCount}</p>
        </div>
      </div>

      {incomes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-slate-400 mb-4">Регулярных доходов пока нет</p>
            <Link
              href="/recurring-incomes/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
            >
              <Plus size={15} />
              Добавить доход
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.map((category) => {
            const categoryIncomes = incomes.filter((income) => income.category === category);
            if (categoryIncomes.length === 0) return null;

            return (
              <section key={category} className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-300">{CATEGORY_LABEL[category]}</h2>
                {categoryIncomes.map((income) => {
                  const editHref = `/recurring-incomes/${income.id}/edit`;
                  const deleteAction = deleteRecurringIncome.bind(null, income.id);

                  return (
                    <Card key={income.id}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-white font-medium">{income.name}</p>
                              <Badge className={CATEGORY_BADGE_CLASS[category]}>
                                {CATEGORY_LABEL[category]}
                              </Badge>
                            </div>

                            <p className="text-sm text-slate-300 mt-2">
                              {formatCurrency(income.amount, income.currency)} /{" "}
                              {
                                PERIOD_LABEL[
                                  income.billingPeriod as CreateRecurringIncomeInput["billingPeriod"]
                                ]
                              }
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Хранилище: {income.vault.name}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Следующее поступление: {formatDate(income.nextIncomeDate)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Link
                              href={editHref}
                              className="px-3 py-1.5 rounded-md border border-slate-500/40 text-slate-300 hover:bg-slate-700/40 transition-colors text-sm"
                            >
                              Редактировать
                            </Link>
                            <DeleteRecurringIncomeButton action={deleteAction} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
