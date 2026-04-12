import pdfParse from "pdf-parse";

import type { ParsedTransaction } from "./types";

const SECTION_MARKER = "Расшифровка операций";

/**
 * В PDF Сбера дата и время часто слиты без пробела: 12.04.202614:29,
 * затем категория и две суммы в конце строки (операция + остаток), иногда без пробела между ними.
 */
const TX_LINE_RE = /^(.*?)([+\-]?\d[\d\s\u00a0\u202f]*,\d{2})([+\-]?\d[\d\s\u00a0\u202f]*,\d{2})$/;

const HEAD_DT_CAT_RE = /^(\d{2}\.\d{2}\.\d{4})(\d{2}:\d{2})(.*)$/;

export class SberbankPdfParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SberbankPdfParseError";
  }
}

export interface ParseSberbankPdfResult {
  transactions: ParsedTransaction[];
  errors: string[];
  skippedByStatus: number;
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const dataBuffer = Buffer.from(buffer);
  const data = await pdfParse(dataBuffer);
  return typeof data.text === "string" ? data.text : "";
}

function normalizePdfSpaces(s: string): string {
  return s.replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
}

function parseRuAmountToken(token: string): number {
  const t = normalizePdfSpaces(token).replace(/\s/g, "").replace(",", ".").replace(/^\+/, "");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

function parseHeadToDateAndCategory(head: string): { date: Date; category: string } | null {
  const h = head.trim();
  const m = h.match(HEAD_DT_CAT_RE);
  if (!m) return null;
  const day = Number(m[1].slice(0, 2));
  const month = Number(m[1].slice(3, 5)) - 1;
  const year = Number(m[1].slice(6, 10));
  const hh = Number(m[2].slice(0, 2));
  const mm = Number(m[2].slice(3, 5));
  const d = new Date(year, month, day, hh, mm, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  const category = (m[3] ?? "").trim();
  if (!category) return null;
  return { date: d, category };
}

/** Строка с двумя суммами в конце и датой+временем в начале (одна строка операции). */
function parseTransactionMainLine(line: string): { date: Date; category: string; opRaw: string } | null {
  const n = normalizePdfSpaces(line).trim();
  const m = n.match(TX_LINE_RE);
  if (!m) return null;
  const headPart = m[1].trim();
  const opRaw = m[2].trim();
  const balRaw = m[3].trim();
  if (!opRaw || !balRaw) return null;
  const parsedHead = parseHeadToDateAndCategory(headPart);
  if (!parsedHead) return null;
  const opVal = parseRuAmountToken(opRaw);
  const balVal = parseRuAmountToken(balRaw);
  if (!Number.isFinite(opVal) || !Number.isFinite(balVal)) return null;
  return { date: parsedHead.date, category: parsedHead.category, opRaw };
}

function signedAmountFromOpRaw(opRaw: string): number {
  const trimmed = normalizePdfSpaces(opRaw).trim();
  const absVal = Math.abs(parseRuAmountToken(trimmed));
  if (!Number.isFinite(absVal)) return 0;
  const isIncome = trimmed.startsWith("+");
  return isIncome ? absVal : -absVal;
}

/** Очистка строки описания из PDF (дата обработки, код авторизации, префикс Т-Банка). */
function cleanDescriptionLine(line: string): string {
  let s = normalizePdfSpaces(line).trim();
  s = s.replace(/^\d{2}\.\d{2}\.\d{4}/, "");
  s = s.replace(/^\d{6}/, "");
  s = s.replace(/^Т-Банк\.\s*/i, "").replace(/^T-Bank\.\s*/i, "");
  return s.trim();
}

function inferPdfType(
  category: string,
  description: string,
  signedAmount: number
): ParsedTransaction["type"] {
  const c = category.trim().toLowerCase();
  const d = description.trim().toLowerCase();
  if (c === "переводы" || c.includes("перевод") || d.includes("перевод") || d.includes("сбп")) {
    return "transfer";
  }
  if (signedAmount > 0) return "income";
  if (signedAmount < 0) return "expense";
  return "expense";
}

function extractLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function isNoiseLine(line: string): boolean {
  const s = line.toLowerCase();
  if (s.includes("дата операции")) return true;
  if (s.includes("дата обработки") && s.includes("авторизации")) return true;
  if (s === "категория" || s.startsWith("категория")) return true;
  if (s.includes("описание операции")) return true;
  if (s.includes("сумма в валюте счёта") || s.includes("сумма в валюте")) return true;
  if (s.includes("остаток средств")) return true;
  if (s.includes("в валюте счёта")) return true;
  if (s.includes("продолжение на следующей")) return true;
  if (/выписка по счёту.*страница/i.test(line)) return true;
  if (s.includes("итого по операциям")) return true;
  if (s.startsWith("остаток на ") && /^\d{2}\.\d{2}\.\d{4}/.test(line.slice("остаток на ".length).trim())) return true;
  return false;
}

function formatPdfReadError(err: unknown): string {
  const base =
    "Не удалось прочитать PDF. Убедитесь, что файл не повреждён, не защищён паролем и это выписка в формате PDF.";
  if (err instanceof Error && err.message.trim()) {
    const short = err.message.length > 180 ? `${err.message.slice(0, 180)}…` : err.message;
    return `${base} (${short})`;
  }
  return base;
}

/**
 * Парсинг PDF-выписки Сбербанка (текст через pdf-parse 1.x).
 * Формат строки операции: DD.MM.YYYYHH:MMКатегорияСуммаОстаток (две суммы с ,кк в конце).
 * @throws SberbankPdfParseError если нет раздела операций или не найдено ни одной операции
 */
export async function parseSberbankPdf(buffer: ArrayBuffer): Promise<ParseSberbankPdfResult> {
  let text: string;
  try {
    text = await extractPdfText(buffer);
  } catch (e) {
    throw new SberbankPdfParseError(formatPdfReadError(e));
  }

  if (!text.includes(SECTION_MARKER)) {
    throw new SberbankPdfParseError(
      "Не найден раздел с операциями. Убедитесь что это выписка Сбербанка."
    );
  }

  const lines = extractLines(text);
  const sectionIdx = lines.findIndex((l) => l.includes(SECTION_MARKER));
  if (sectionIdx === -1) {
    throw new SberbankPdfParseError(
      "Не найден раздел с операциями. Убедитесь что это выписка Сбербанка."
    );
  }

  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  let i = sectionIdx + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (isNoiseLine(line)) {
      i += 1;
      continue;
    }

    const main = parseTransactionMainLine(line);
    if (!main) {
      i += 1;
      continue;
    }

    const descParts: string[] = [];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (isNoiseLine(next)) {
        j += 1;
        continue;
      }
      if (parseTransactionMainLine(next)) break;
      descParts.push(next);
      j += 1;
    }

    const description = descParts
      .map((part) => cleanDescriptionLine(part))
      .filter((part) => part.length > 0)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const fullTextForSkip = `${main.category} ${description}`.toLowerCase();
    if (fullTextForSkip.includes("остаток на")) {
      i = j;
      continue;
    }

    const signedAmount = signedAmountFromOpRaw(main.opRaw);
    const type = inferPdfType(main.category, description, signedAmount);

    transactions.push({
      date: main.date,
      amount: signedAmount,
      currency: "RUB",
      description: description.length > 0 ? description : main.category,
      category: main.category,
      rawCategory: main.category,
      type,
      needsClassification: type === "transfer",
      bankSource: "sberbank",
    });

    i = j;
  }

  if (transactions.length === 0) {
    throw new SberbankPdfParseError(
      "Операции не найдены. Возможно выписка пустая или формат изменился."
    );
  }

  return { transactions, errors, skippedByStatus: 0 };
}
