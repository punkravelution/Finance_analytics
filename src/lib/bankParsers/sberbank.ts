import type { ParsedTransaction } from "./types";

function decodeWindows1251(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("windows-1251", { fatal: false }).decode(buffer);
  } catch {
    try {
      return new TextDecoder("cp1251", { fatal: false }).decode(buffer);
    } catch {
      return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    }
  }
}

function parseSberDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  const year = Number(m[3]);
  const d = new Date(year, month, day, 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAmountRu(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ";" && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function inferType(description: string, amount: number): "income" | "expense" | "transfer" {
  const d = description.toLowerCase();
  if (d.includes("перевод") || d.includes("сбп")) {
    return "transfer";
  }
  return amount >= 0 ? "income" : "expense";
}

export interface ParseSberbankResult {
  transactions: ParsedTransaction[];
  errors: string[];
  /** Строки с другим статусом (не «Исполнен»), не попали в transactions */
  skippedByStatus: number;
}

/**
 * Парсинг CSV выписки Сбербанка (разделитель `;`, кодировка windows-1251).
 */
export function parseSberbankCsv(buffer: ArrayBuffer): ParseSberbankResult {
  const text = decodeWindows1251(buffer);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  if (lines.length < 2) {
    errors.push("Файл не содержит данных (ожидалась строка заголовка и операции).");
    return { transactions, errors, skippedByStatus: 0 };
  }

  let skippedByStatus = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = splitCsvLine(line);
    if (cols.length < 10) {
      errors.push(`Строка ${i + 1}: недостаточно колонок (${cols.length}).`);
      continue;
    }

    const status = cols[9]?.trim() ?? "";
    if (status !== "Исполнен") {
      skippedByStatus += 1;
      continue;
    }

    const dateStr = cols[0] ?? "";
    const date = parseSberDate(dateStr);
    if (!date) {
      errors.push(`Строка ${i + 1}: неверная дата «${dateStr}».`);
      continue;
    }

    const amountRaw = cols[8] ?? "";
    const amount = parseAmountRu(amountRaw);
    if (amount === null) {
      errors.push(`Строка ${i + 1}: неверная сумма «${amountRaw}».`);
      continue;
    }

    const description = cols[3]?.trim() ?? "";
    const category = cols[4]?.trim() ?? "";
    const currency = (cols[5]?.trim() || "RUB").toUpperCase();

    const type = inferType(description, amount);
    transactions.push({
      date,
      amount,
      currency,
      description,
      category,
      rawCategory: category,
      type,
      needsClassification: type === "transfer",
      bankSource: "sberbank",
    });
  }

  return { transactions, errors, skippedByStatus };
}
