"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart2, TrendingDown, CreditCard, Target, FileText } from "lucide-react";

interface DownloadAiReportButtonProps {
  className?: string;
}

export function DownloadAiReportButton({ className }: DownloadAiReportButtonProps) {
  const [loadingMode, setLoadingMode] = useState<
    "full" | "briefing" | "expenses" | "debts" | "goals" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const onDownload = async (
    mode: "full" | "briefing" | "expenses" | "debts" | "goals"
  ) => {
    if (loadingMode) return;
    setLoadingMode(mode);
    setError(null);
    try {
      const endpointByMode: Record<typeof mode, string> = {
        full: "/api/export-report",
        briefing: "/api/export-report?mode=briefing",
        expenses: "/api/export-report?mode=expenses",
        debts: "/api/export-report?mode=debts",
        goals: "/api/export-report?mode=goals",
      };
      const response = await fetch(endpointByMode[mode]);
      if (!response.ok) {
        throw new Error("Не удалось сформировать отчёт.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        const date = new Date().toISOString().split("T")[0];
        const fileByMode: Record<typeof mode, string> = {
          briefing: `finance-briefing-${date}.md`,
          expenses: `expenses-analysis-${date}.md`,
          debts: `debt-strategy-${date}.md`,
          goals: `goals-forecast-${date}.md`,
          full: `finance-report-${date}.md`,
        };
        a.download = fileByMode[mode];
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка скачивания отчёта.");
    } finally {
      setLoadingMode(null);
    }
  };

  const cards: Array<{
    mode: "briefing" | "expenses" | "debts" | "goals" | "full";
    title: string;
    description: string;
    Icon: typeof BarChart2;
  }> = [
    {
      mode: "briefing",
      title: "Финансовый брифинг",
      description: "Полная сводка ~1 стр. Лучший старт для анализа",
      Icon: BarChart2,
    },
    {
      mode: "expenses",
      title: "Анализ расходов",
      description: "Где утекают деньги и что сократить",
      Icon: TrendingDown,
    },
    {
      mode: "debts",
      title: "Стратегия долгов",
      description: "Как погасить быстрее и дешевле",
      Icon: CreditCard,
    },
    {
      mode: "goals",
      title: "Прогноз по целям",
      description: "Реалистичны ли цели и как их ускорить",
      Icon: Target,
    },
    {
      mode: "full",
      title: "Полный отчёт + транзакции",
      description: "Все данные включая транзакции за 3 мес",
      Icon: FileText,
    },
  ];

  return (
    <div className={className}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">Экспорт для AI-анализа</h3>
        <p className="text-xs text-slate-400">Скачайте нужный файл и отправьте его Claude или ChatGPT</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ mode, title, description, Icon }) => (
          <Card key={mode} className="border border-slate-200 bg-white text-slate-900">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Icon size={16} className="text-slate-700" />
                <p className="text-sm font-semibold">{title}</p>
              </div>
              <p className="mb-3 text-xs text-slate-600">{description}</p>
              <button
                type="button"
                onClick={() => void onDownload(mode)}
                disabled={loadingMode !== null}
                className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {loadingMode === mode ? "Формирование..." : "Скачать"}
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
