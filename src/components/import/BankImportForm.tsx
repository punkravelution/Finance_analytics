"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { parseTbankCsv } from "@/lib/bankParsers/tbank";
import type { ParsedTransaction } from "@/lib/bankParsers/types";
type BankChoice = "sberbank" | "tbank";

interface ImportBankResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
}

interface VaultOption {
  id: string;
  name: string;
}

interface BankImportFormProps {
  vaults: VaultOption[];
}

function parseTbankPreview(buffer: ArrayBuffer): { rows: ParsedTransaction[]; errors: string[] } {
  const r = parseTbankCsv(buffer);
  return { rows: r.transactions, errors: r.errors };
}

function revivePdfTransactions(raw: unknown): ParsedTransaction[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedTransaction[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const dateRaw = r.date;
    const date =
      typeof dateRaw === "string"
        ? new Date(dateRaw)
        : dateRaw instanceof Date
          ? dateRaw
          : null;
    if (!date || Number.isNaN(date.getTime())) continue;
    const amount = typeof r.amount === "number" ? r.amount : Number(r.amount);
    if (!Number.isFinite(amount)) continue;
    const currency = typeof r.currency === "string" ? r.currency : "RUB";
    const description = typeof r.description === "string" ? r.description : "";
    const category = typeof r.category === "string" ? r.category : "";
    const rawCategory = typeof r.rawCategory === "string" ? r.rawCategory : category;
    const type = r.type === "income" || r.type === "expense" || r.type === "transfer" ? r.type : "expense";
    out.push({
      date,
      amount,
      currency,
      description,
      category,
      rawCategory,
      type,
      bankSource: "sberbank",
    });
  }
  return out;
}

export function BankImportForm({ vaults }: BankImportFormProps) {
  const [bank, setBank] = useState<BankChoice>("sberbank");
  const [file, setFile] = useState<File | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [vaultId, setVaultId] = useState<string>(vaults[0]?.id ?? "");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportBankResult | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ rows: ParsedTransaction[]; errors: string[] } | null>(
    null
  );
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);

  const tbankPreview = useMemo(() => {
    if (bank !== "tbank" || !buffer) return { rows: [] as ParsedTransaction[], errors: [] as string[] };
    return parseTbankPreview(buffer);
  }, [bank, buffer]);

  useEffect(() => {
    if (bank !== "sberbank" || !file?.name.toLowerCase().endsWith(".pdf")) {
      setPdfPreview(null);
      setPdfPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPdfPreviewLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    void fetch("/api/import-bank/preview", { method: "POST", body: fd })
      .then(async (res) => {
        const json = (await res.json()) as { transactions?: unknown[]; errors?: string[] };
        if (cancelled) return;
        if (!res.ok) {
          const errList = Array.isArray(json.errors) ? json.errors : ["Ошибка предпросмотра"];
          setPdfPreview({ rows: [], errors: errList });
          return;
        }
        const rows = revivePdfTransactions(json.transactions ?? []);
        setPdfPreview({ rows, errors: Array.isArray(json.errors) ? json.errors : [] });
      })
      .catch(() => {
        if (!cancelled) {
          setPdfPreview({ rows: [], errors: ["Не удалось получить предпросмотр PDF."] });
        }
      })
      .finally(() => {
        if (!cancelled) setPdfPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bank, file]);

  const preview =
    bank === "tbank"
      ? tbankPreview
      : { rows: pdfPreview?.rows ?? [], errors: pdfPreview?.errors ?? [] };

  const previewRows = preview.rows.slice(0, 10);

  const onPickFile = useCallback(
    async (f: File | null) => {
      setClientError(null);
      setResult(null);
      if (!f) {
        setFile(null);
        setBuffer(null);
        return;
      }
      const lower = f.name.toLowerCase();
      if (bank === "sberbank") {
        if (!lower.endsWith(".pdf")) {
          setClientError("Для Сбербанка загрузите PDF выписку (.pdf).");
          setFile(null);
          setBuffer(null);
          return;
        }
      } else if (!lower.endsWith(".csv")) {
        setClientError("Для Т-Банка нужен файл CSV (.csv).");
        setFile(null);
        setBuffer(null);
        return;
      }
      setFile(f);
      try {
        const buf = await f.arrayBuffer();
        setBuffer(buf);
      } catch {
        setClientError("Не удалось прочитать файл.");
        setFile(null);
        setBuffer(null);
      }
    },
    [bank]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      void onPickFile(f ?? null);
    },
    [onPickFile]
  );

  const onImport = async () => {
    setClientError(null);
    setResult(null);
    if (!file || !vaultId) {
      setClientError("Выберите файл и хранилище.");
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bank", bank);
      fd.append("vaultId", vaultId);
      fd.append("skipDuplicates", skipDuplicates ? "true" : "false");

      const res = await fetch("/api/import-bank", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as ImportBankResult;
      if (!res.ok) {
        setClientError(json.errors[0] ?? `Ошибка ${res.status}`);
        setResult(json);
        return;
      }
      setResult(json);
    } catch {
      setClientError("Сеть недоступна или сервер не ответил.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => {
            setBank("sberbank");
            setResult(null);
            setPdfPreview(null);
            setClientError(null);
            if (file?.name.toLowerCase().endsWith(".csv")) {
              setFile(null);
              setBuffer(null);
            }
          }}
          className={cn(
            "rounded-xl border-2 p-6 text-left transition-all",
            bank === "sberbank"
              ? "border-green-500/70 bg-green-500/10"
              : "border-[hsl(216,34%,20%)] bg-[hsl(222,47%,8%)] hover:border-[hsl(216,34%,30%)]"
          )}
        >
          <p className="text-lg font-semibold text-white">Сбербанк</p>
          <p className="text-xs text-slate-500 mt-1">PDF выписка по карте</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setBank("tbank");
            setResult(null);
            setPdfPreview(null);
            setClientError(null);
            if (file?.name.toLowerCase().endsWith(".pdf")) {
              setFile(null);
              setBuffer(null);
            }
          }}
          className={cn(
            "rounded-xl border-2 p-6 text-left transition-all",
            bank === "tbank"
              ? "border-yellow-500/60 bg-yellow-500/10"
              : "border-[hsl(216,34%,20%)] bg-[hsl(222,47%,8%)] hover:border-[hsl(216,34%,30%)]"
          )}
        >
          <p className="text-lg font-semibold text-white">Т-Банк</p>
          <p className="text-xs text-slate-500 mt-1">CSV, UTF-8</p>
        </button>
      </div>

      <details className="rounded-lg border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,8%)] px-4 py-3 text-sm text-slate-300">
        <summary className="cursor-pointer text-slate-200 font-medium select-none">
          Как скачать выписку
        </summary>
        <ul className="mt-3 space-y-2 list-disc pl-5 text-slate-400">
          <li>
            <strong className="text-slate-300">Сбербанк:</strong> СберОнлайн → карта → Выписка → Скачать
            (PDF).
          </li>
          <li>
            <strong className="text-slate-300">Т-Банк:</strong> Главная → меню «⋯» по счёту → Выписка →
            Скачать CSV.
          </li>
        </ul>
      </details>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Файл выписки</label>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className={cn(
            "rounded-xl border-2 border-dashed border-[hsl(216,34%,25%)] bg-[hsl(222,47%,7%)]",
            "px-6 py-10 text-center transition-colors hover:border-blue-500/40"
          )}
        >
          <Upload className="h-8 w-8 mx-auto text-slate-500 mb-3" aria-hidden />
          <p className="text-sm text-slate-400 mb-3">
            {bank === "sberbank"
              ? "Перетащите PDF файл выписки или выберите файл"
              : "Перетащите CSV файл выписки или выберите файл"}
          </p>
          <input
            type="file"
            accept={bank === "sberbank" ? ".pdf,application/pdf" : ".csv,text/csv"}
            className="hidden"
            id="bank-csv-input"
            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
          />
          <label
            htmlFor="bank-csv-input"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "inline-flex cursor-pointer"
            )}
          >
            Выбрать файл
          </label>
          {file && <p className="text-xs text-slate-400 mt-3 truncate max-w-full">{file.name}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="vault-select" className="block text-sm font-medium text-slate-300 mb-2">
          Хранилище
        </label>
        {vaults.length === 0 ? (
          <p className="text-sm text-amber-400">
            Нет активных счетов с ручным балансом. Создайте хранилище в разделе «Хранилища».
          </p>
        ) : (
          <select
            id="vault-select"
            value={vaultId}
            onChange={(e) => setVaultId(e.target.value)}
            className="w-full rounded-md border border-[hsl(216,34%,20%)] bg-[hsl(224,71%,8%)] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {vaults.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={skipDuplicates}
          onChange={(e) => setSkipDuplicates(e.target.checked)}
          className="rounded border-slate-600"
        />
        Пропускать дубликаты (та же дата ±1 день, сумма и описание)
      </label>

      {clientError && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {clientError}
        </div>
      )}

      {pdfPreviewLoading && bank === "sberbank" && file?.name.toLowerCase().endsWith(".pdf") && (
        <p className="text-sm text-slate-500">Разбор PDF для предпросмотра…</p>
      )}

      {buffer &&
        !pdfPreviewLoading &&
        preview.errors.length > 0 &&
        preview.rows.length === 0 && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          <p className="font-medium mb-1">Файл не распознан как выписка</p>
          <ul className="list-disc pl-5 space-y-0.5 text-amber-200/90">
            {preview.errors.slice(0, 6).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {previewRows.length > 0 && (
        <Card className="border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)] p-4">
          <p className="text-sm font-medium text-slate-200 mb-3">Предпросмотр (первые 10 строк)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-slate-500 border-b border-[hsl(216,34%,17%)]">
                  <th className="py-2 pr-3 font-medium">Дата</th>
                  <th className="py-2 pr-3 font-medium">Описание</th>
                  <th className="py-2 pr-3 font-medium">Категория</th>
                  <th className="py-2 font-medium tabular-nums">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-[hsl(216,34%,14%)] text-slate-200">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="py-2 pr-3 max-w-[200px] truncate" title={row.description}>
                      {row.description}
                    </td>
                    <td className="py-2 pr-3 max-w-[120px] truncate" title={row.category}>
                      {row.category || "—"}
                    </td>
                    <td
                      className={cn(
                        "py-2 tabular-nums font-medium",
                        row.amount >= 0 ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {row.amount >= 0 ? "+" : ""}
                      {formatCurrency(row.amount, row.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.errors.length > 0 && (
            <p className="text-[11px] text-amber-400/90 mt-2">
              Предупреждения парсера: {preview.errors.slice(0, 3).join(" · ")}
            </p>
          )}
        </Card>
      )}

      <Button
        type="button"
        onClick={() => void onImport()}
        disabled={importing || !file || !vaultId}
        className="w-full sm:w-auto"
      >
        {importing ? "Импорт…" : "Импортировать"}
      </Button>

      {result && result.imported >= 0 && (
        <div className="rounded-xl border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,8%)] p-4 space-y-3">
          <p className="text-sm text-slate-200">
            Импортировано: <strong className="text-white">{result.imported}</strong>
            {", "}
            строк пропущено по статусу в файле: <strong className="text-white">{result.skipped}</strong>
            {", "}
            пропущено дублей: <strong className="text-white">{result.duplicates}</strong>
          </p>
          {result.errors.length > 0 && (
            <ul className="text-xs text-amber-200 list-disc pl-5 space-y-1">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          <Link
            href="/transactions"
            className={cn(buttonVariants({ variant: "secondary" }), "inline-flex")}
          >
            Перейти к транзакциям
          </Link>
        </div>
      )}

      <p>
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">
          ← На главную
        </Link>
      </p>
    </div>
  );
}
