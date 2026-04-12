import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatCurrency,
  formatGoalDeadlinePhrase,
  formatRelativeDueFromDays,
} from "@/lib/format";
import type { GoalProgressItem } from "@/app/actions/goal";
import type { UpcomingPlannedExpense } from "@/app/actions/plannedExpense";

interface DashboardGoalsPreviewProps {
  goals: GoalProgressItem[];
}

export function DashboardGoalsPreview({ goals }: DashboardGoalsPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Ближайшие цели</CardTitle>
          <Link
            href="/goals"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Все цели →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <div className="text-center py-8 px-2">
            <p className="text-sm text-slate-400 mb-4">Добавьте первую цель</p>
            <Link
              href="/goals/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
            >
              <Plus size={15} />
              Новая цель
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <div key={goal.id} className="space-y-2">
                <p className="text-sm font-medium text-white truncate">{goal.name}</p>
                <Progress value={goal.percentComplete} className="h-1.5" />
                <div className="flex flex-col gap-0.5 text-xs text-slate-400">
                  <span>
                    {formatCurrency(goal.currentAmount, goal.currency)} из{" "}
                    {formatCurrency(goal.targetAmount, goal.currency)}
                  </span>
                  <span className="text-slate-500">{formatGoalDeadlinePhrase(goal.daysUntilTarget)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DashboardPlannedPreviewProps {
  expenses: UpcomingPlannedExpense[];
}

export function DashboardPlannedPreview({ expenses }: DashboardPlannedPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Предстоящие платежи</CardTitle>
          <Link
            href="/goals"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Все платежи →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <div className="text-center py-8 px-2">
            <p className="text-sm text-slate-400">Нет неоплаченных платежей</p>
            <p className="text-xs text-slate-500 mt-1">Запланируйте на странице «Цели и платежи»</p>
          </div>
        ) : (
          <div className="space-y-1">
            {expenses.map((row) => {
              const overdue = row.daysUntilDue != null && row.daysUntilDue < 0;
              return (
                <div
                  key={row.id}
                  className={`flex flex-col gap-0.5 p-2.5 rounded-lg transition-colors ${
                    overdue
                      ? "bg-red-950/30 border border-red-500/25"
                      : "hover:bg-[hsl(216,34%,12%)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm font-medium truncate ${
                        overdue ? "text-red-200" : "text-white"
                      }`}
                    >
                      {row.name}
                    </p>
                    <span
                      className={`text-sm font-semibold tabular-nums shrink-0 ${
                        overdue ? "text-red-300" : "text-slate-200"
                      }`}
                    >
                      {formatCurrency(row.amount, row.currency)}
                    </span>
                  </div>
                  <p className={`text-xs ${overdue ? "text-red-300/90" : "text-slate-500"}`}>
                    {formatRelativeDueFromDays(row.daysUntilDue)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
