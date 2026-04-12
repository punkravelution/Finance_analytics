import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { GoalProgressItem } from "@/app/actions/goal";
import type { GoalCategory, GoalPriority } from "@/types";
import { GoalTopUpButton } from "./GoalTopUpButton";

const CATEGORY_LABEL: Record<GoalCategory, string> = {
  gadget: "Гаджеты",
  travel: "Путешествия",
  education: "Образование",
  realty: "Недвижимость",
  emergency: "Резерв",
  other: "Другое",
};

const CATEGORY_BADGE: Record<GoalCategory, string> = {
  gadget: "bg-violet-100 text-violet-900 border-violet-200",
  travel: "bg-sky-100 text-sky-900 border-sky-200",
  education: "bg-amber-100 text-amber-900 border-amber-200",
  realty: "bg-orange-100 text-orange-900 border-orange-200",
  emergency: "bg-emerald-100 text-emerald-900 border-emerald-200",
  other: "bg-slate-200 text-slate-800 border-slate-300",
};

const PRIORITY_LABEL: Record<GoalPriority, string> = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

function categoryKey(value: string): GoalCategory {
  const allowed: GoalCategory[] = [
    "gadget",
    "travel",
    "education",
    "realty",
    "emergency",
    "other",
  ];
  return allowed.includes(value as GoalCategory) ? (value as GoalCategory) : "other";
}

function priorityKey(value: string): GoalPriority {
  const allowed: GoalPriority[] = ["high", "medium", "low"];
  return allowed.includes(value as GoalPriority) ? (value as GoalPriority) : "medium";
}

export function GoalsAccumulationTab({ goals }: { goals: GoalProgressItem[] }) {
  const totalCount = goals.length;
  const completedCount = goals.filter((g) => g.isCompleted).length;
  const activeGoals = goals.filter((g) => !g.isCompleted);
  const totalTargetToReach = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const displayCurrency = activeGoals[0]?.currency ?? goals[0]?.currency ?? "RUB";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Всего целей</p>
            <p className="text-xl font-bold text-white">
              {new Intl.NumberFormat("ru-RU").format(totalCount)}
            </p>
          </div>
          <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Завершено</p>
            <p className="text-xl font-bold text-white">
              {new Intl.NumberFormat("ru-RU").format(completedCount)}
            </p>
          </div>
          <div className="bg-[hsl(222,47%,8%)] border border-[hsl(216,34%,17%)] rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Общая сумма к накоплению</p>
            <p className="text-xl font-bold text-white">
              {formatCurrency(totalTargetToReach, displayCurrency)}
            </p>
          </div>
        </div>
        <Link
          href="/goals/new"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
        >
          <Plus size={15} />
          Новая цель
        </Link>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-slate-400 mb-4">Целей пока нет</p>
            <Link
              href="/goals/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
            >
              <Plus size={15} />
              Создать цель
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const cat = categoryKey(goal.category);
            const pr = priorityKey(goal.priority);
            return (
              <Card key={goal.id}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-white font-medium">{goal.name}</p>
                        <Badge className={CATEGORY_BADGE[cat]} variant="outline">
                          {CATEGORY_LABEL[cat]}
                        </Badge>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {PRIORITY_LABEL[pr]}
                        </Badge>
                        {goal.isCompleted && (
                          <Badge className="bg-green-600/20 text-green-300 border-green-500/40">
                            Выполнено
                          </Badge>
                        )}
                      </div>
                      {goal.vault && (
                        <p className="text-xs text-slate-500">Хранилище: {goal.vault.name}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <GoalTopUpButton
                        goalId={goal.id}
                        currency={goal.currency}
                        disabled={goal.isCompleted}
                      />
                      <Link
                        href={`/goals/${goal.id}/edit`}
                        className="px-3 py-1.5 rounded-md border border-slate-500/40 text-slate-300 hover:bg-slate-700/40 transition-colors text-sm"
                      >
                        Редактировать
                      </Link>
                    </div>
                  </div>

                  <Progress value={goal.percentComplete} className="h-2" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
                    <p>
                      {formatCurrency(goal.currentAmount, goal.currency)} →{" "}
                      {formatCurrency(goal.targetAmount, goal.currency)}
                    </p>
                    <p>
                      Осталось:{" "}
                      <span className="text-white font-medium">
                        {formatCurrency(goal.remaining, goal.currency)}
                      </span>
                    </p>
                    <p>
                      До даты:{" "}
                      {goal.targetDate ? (
                        <>
                          {goal.daysUntilTarget != null && (
                            <span className="text-white font-medium">
                              {new Intl.NumberFormat("ru-RU", {
                                signDisplay: "exceptZero",
                                maximumFractionDigits: 0,
                              }).format(goal.daysUntilTarget)}{" "}
                              дн.
                            </span>
                          )}
                          <span className="text-slate-500">
                            {" "}
                            ({formatDate(goal.targetDate)})
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500">не задана</span>
                      )}
                    </p>
                    <p>
                      В месяц:{" "}
                      <span className="text-white font-medium">
                        {goal.monthlyRequired != null
                          ? formatCurrency(goal.monthlyRequired, goal.currency)
                          : "—"}
                      </span>
                    </p>
                  </div>

                  <p className="text-xs text-slate-500">
                    Прогресс: {formatNumber(goal.percentComplete, 1)}%
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
