"use client";

import { useState } from "react";

interface DownloadAiReportButtonProps {
  className?: string;
}

export function DownloadAiReportButton({ className }: DownloadAiReportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDownload = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/export-report");
      if (!response.ok) {
        throw new Error("Не удалось сформировать отчёт.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = `finance-report-${new Date().toISOString().split("T")[0]}.md`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка скачивания отчёта.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void onDownload()}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "Формирование..." : "Скачать отчёт для AI"}
      </button>
      <p className="mt-2 text-xs text-slate-500">
        Скачайте отчёт и отправьте его Claude или ChatGPT для глубокого анализа финансов
      </p>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
