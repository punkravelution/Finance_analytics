import pdfParse from "pdf-parse";

import type { ParsedTransaction } from "./types";

const SECTION_START = "Движение средств за период";
const SECTION_END = "Пополнения:";

const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const CARD_TAIL_RE = /^(\d{4}|—|-)$/;

const TRANSFER_MARKERS = [
  "внутренний перевод",
  "внутрибанковский перевод",
  "внешний перевод",
  "пополнение. сбербанк",
  "пополнение. система быстрых платежей",
];

export class TbankPdfParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TbankPdfParseError";
  }
}

export interface ParseTbankPdfResult {
  transactions: ParsedTransaction[];
  errors: string[];
  skippedByStatus: number;
}

function normalizeSpaces(s: string): string {
  return s.replace(/\u00a0/g, " ").replace(/\u202f/g, " ");
}

function extractLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => normalizeSpaces(line).trim())
    .filter((line) => line.length > 0);
}

function parseDate(dateText: string, timeText: string): Date | null {
  const d = dateText.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const t = timeText.match(/^(\d{2}):(\d{2})$/);
  if (!d || !t) return null;
  const day = Number(d[1]);
  const month = Number(d[2]) - 1;
  const year = Number(d[3]);
  const hh = Number(t[1]);
  const mm = Number(t[2]);
  const dt = new Date(year, month, day, hh, mm, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseAmount(raw: string): number | null {
  const cleaned = normalizeSpaces(raw)
    .replace(/₽/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function cleanDescription(raw: string): string {
  return raw
    .replace(/^Оплата в\s+/i, "")
    .replace(/^Пополнение\.\s*/i, "")
    .replace(/Внешний перевод по номеру телефона\s*([+]\d{10,15})?/i, (_m, p1: string | undefined) =>
      p1 ? `Перевод ${p1}` : "Перевод"
    )
    .replace(/Внутрибанковский перевод с договора\s+\S+/i, "Входящий перевод")
    .replace(/Внутренний перевод на договор\s+\S+/i, "Исходящий перевод")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function inferTypeByDescription(description: string, amount: number): ParsedTransaction["type"] {
  const low = description.toLowerCase();
  const isTransfer = TRANSFER_MARKERS.some((marker) => low.includes(marker));
  if (isTransfer) return "transfer";
  if (low.includes("оплата в") || low.includes("плата за")) return "expense";
  if (amount > 0) return "income";
  return "expense";
}

function shouldSkipCommission(description: string, amount: number): boolean {
  const low = description.toLowerCase();
  const isCommission =
    low.includes("плата за обслуживание") || low.includes("плата за оповещения");
  return isCommission && Math.abs(amount) < 200;
}

function formatPdfReadError(err: unknown): string {
  const base =
    "Не удалось прочитать PDF Т-Банка. Убедитесь, что это «Справка о движении средств» и файл не повреждён.";
  if (err instanceof Error && err.message.trim()) {
    const short = err.message.length > 180 ? `${err.message.slice(0, 180)}…` : err.message;
    return `${base} (${short})`;
  }
  return base;
}

export async function parseTbankPdf(buffer: ArrayBuffer): Promise<ParseTbankPdfResult> {
  let text: string;
  try {
    const data = await pdfParse(Buffer.from(buffer));
    text = typeof data.text === "string" ? data.text : "";
  } catch (e) {
    throw new TbankPdfParseError(formatPdfReadError(e));
  }

  const lines = extractLines(text);
  const sectionStartIdx = lines.findIndex((line) => line.includes(SECTION_START));
  if (sectionStartIdx === -1) {
    throw new TbankPdfParseError("Не найден раздел «Движение средств за период».");
  }

  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  let i = sectionStartIdx + 1;

  while (i < lines.length) {
    const current = lines[i];
    if (current.startsWith(SECTION_END)) break;
    if (!DATE_RE.test(current)) {
      i += 1;
      continue;
    }

    const opDateText = current;
    const opTimeText = lines[i + 1] ?? "";
    const postingDateText = lines[i + 2] ?? "";
    const postingTimeText = lines[i + 3] ?? "";
    const opAmountText = lines[i + 4] ?? "";
    const cardAmountText = lines[i + 5] ?? "";

    if (!TIME_RE.test(opTimeText) || !DATE_RE.test(postingDateText) || !TIME_RE.test(postingTimeText)) {
      errors.push(`Строка ${i + 1}: не удалось распознать дату/время операции.`);
      i += 1;
      continue;
    }

    const date = parseDate(opDateText, opTimeText);
    if (!date) {
      errors.push(`Строка ${i + 1}: неверная дата операции ${opDateText} ${opTimeText}.`);
      i += 1;
      continue;
    }

    const amount = parseAmount(opAmountText);
    const amountCard = parseAmount(cardAmountText);
    if (amount === null || amountCard === null) {
      errors.push(`Строка ${i + 1}: не удалось распознать сумму операции.`);
      i += 1;
      continue;
    }

    let j = i + 6;
    const descriptionParts: string[] = [];
    while (j < lines.length) {
      const line = lines[j];
      if (line.startsWith(SECTION_END) || DATE_RE.test(line) || CARD_TAIL_RE.test(line)) {
        break;
      }
      descriptionParts.push(line);
      j += 1;
    }
    if (j < lines.length && CARD_TAIL_RE.test(lines[j] ?? "")) {
      j += 1;
    }

    const rawDescription = descriptionParts.join(" ").replace(/\s{2,}/g, " ").trim();
    const cleanedDescription = cleanDescription(rawDescription);
    if (!cleanedDescription) {
      i = j;
      continue;
    }

    if (shouldSkipCommission(cleanedDescription, amount)) {
      i = j;
      continue;
    }

    const type = inferTypeByDescription(cleanedDescription, amount);
    transactions.push({
      date,
      amount,
      currency: "RUB",
      description: cleanedDescription,
      category: cleanedDescription,
      rawCategory: cleanedDescription,
      type,
      needsClassification: type === "transfer",
      bankSource: "tbank",
    });

    i = j;
  }

  if (transactions.length === 0) {
    throw new TbankPdfParseError("Операции не найдены. Проверьте, что загружена «Справка о движении средств».");
  }

  return { transactions, errors, skippedByStatus: 0 };
}
