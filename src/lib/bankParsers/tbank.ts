import type { ParsedTransaction } from "./types";

function parseTbankDate(s: string): Date | null {
  const trimmed = s.trim();
  const datePart = trimmed.split(/\s+/)[0] ?? "";
  const m = datePart.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
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
  return line.split(";").map((c) => c.trim());
}

function inferType(
  description: string,
  category: string,
  amount: number
): "income" | "expense" | "transfer" {
  const desc = description.toLowerCase();
  const cat = category.trim().toLowerCase();
  if (desc.includes("перевод") || cat === "переводы" || cat.includes("перевод")) {
    return "transfer";
  }
  return amount >= 0 ? "income" : "expense";
}

export interface ParseTbankResult {
  transactions: ParsedTransaction[];
  errors: string[];
  skippedByStatus: number;
}

/**
 * Парсинг CSV выписки Т-Банка (разделитель `;`, UTF-8).
 */
export function parseTbankCsv(buffer: ArrayBuffer): ParseTbankResult {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
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
    if (cols.length < 12) {
      errors.push(`Строка ${i + 1}: недостаточно колонок (${cols.length}).`);
      continue;
    }

    const status = (cols[3]?.trim() ?? "").toUpperCase();
    if (status !== "OK" && status !== "COMPLETE") {
      skippedByStatus += 1;
      continue;
    }

    const dateStr = cols[0] ?? "";
    const date = parseTbankDate(dateStr);
    if (!date) {
      errors.push(`Строка ${i + 1}: неверная дата «${dateStr}».`);
      continue;
    }

    const amountRaw = cols[4] ?? "";
    const amount = parseAmountRu(amountRaw);
    if (amount === null) {
      errors.push(`Строка ${i + 1}: неверная сумма «${amountRaw}».`);
      continue;
    }

    const currency = (cols[5]?.trim() || "RUB").toUpperCase();
    const category = cols[9]?.trim() ?? "";
    const description = cols[11]?.trim() ?? "";

    transactions.push({
      date,
      amount,
      currency,
      description,
      category,
      rawCategory: category,
      type: inferType(description, category, amount),
      bankSource: "tbank",
    });
  }

  return { transactions, errors, skippedByStatus };
}
