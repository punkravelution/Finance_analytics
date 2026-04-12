"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Landmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  deleteImportSession,
  type ImportSessionListItemSerialized,
} from "@/app/actions/importSession";

function formatImportDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function formatPeriod(from: Date | string, to: Date | string): string {
  return `${formatDate(from)} — ${formatDate(to)}`;
}

function bankLabel(source: string): string {
  return source === "tbank" ? "Т-Банк" : "Сбербанк";
}

interface ImportHistoryProps {
  sessions: ImportSessionListItemSerialized[];
}

export function ImportHistory({ sessions }: ImportHistoryProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onDelete = useCallback((id: string, fileName: string) => {
    const ok = window.confirm(
      `Удалить импорт «${fileName}» и все связанные транзакции? Это действие нельзя отменить.`
    );
    if (!ok) return;
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteImportSession(id);
      setPendingId(null);
      if (res.ok) {
        setNotice(`Удалено ${res.deletedCount} ${pluralTx(res.deletedCount)}.`);
        router.refresh();
      } else {
        setNotice(res.error);
      }
    });
  }, [router]);

  if (sessions.length === 0) {
    return (
      <Card className="border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)] p-4">
        <p className="text-sm text-slate-500">Пока нет завершённых импортов.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">История импортов</h2>
      {notice && (
        <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
          {notice}
        </div>
      )}
      <ul className="space-y-3">
        {sessions.map((s) => {
          const isSber = s.bankSource !== "tbank";
          const busy = isPending && pendingId === s.id;
          return (
            <li key={s.id}>
              <Card className="border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)] p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    isSber ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"
                  )}
                  aria-hidden
                >
                  {isSber ? <Landmark className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-slate-100 truncate" title={s.fileName}>
                    {s.fileName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {bankLabel(s.bankSource)} · {s.vault.name}
                  </p>
                  <p className="text-sm text-slate-300">
                    Период: {formatPeriod(s.dateFrom, s.dateTo)}
                  </p>
                  <p className="text-sm text-slate-400">
                    {s.totalCount} импортировано, {s.skippedCount} пропущено как дубли
                  </p>
                  <p className="text-xs text-slate-500">{formatImportDateTime(s.createdAt)}</p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="shrink-0 self-start"
                  disabled={busy}
                  onClick={() => onDelete(s.id, s.fileName)}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" aria-hidden />
                  {busy ? "…" : "Удалить импорт"}
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function pluralTx(n: number): string {
  const k = Math.abs(n) % 100;
  const k1 = k % 10;
  if (k > 10 && k < 20) return "транзакций";
  if (k1 > 1 && k1 < 5) return "транзакции";
  if (k1 === 1) return "транзакция";
  return "транзакций";
}
