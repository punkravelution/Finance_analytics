import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseSberbankCsv } from "@/lib/bankParsers/sberbank";
import { parseSberbankPdf, SberbankPdfParseError } from "@/lib/bankParsers/sberbank-pdf";
import { parseTbankCsv } from "@/lib/bankParsers/tbank";
import { createImportedCategoryResolver } from "@/lib/bankParsers/categoryMapper";
import type { ParsedTransaction } from "@/lib/bankParsers/types";
import {
  isDescriptionExcludedFromAutoCategory,
  matchCategoryRule,
  sortRulesForMatching,
} from "@/lib/categoryMatcher";
import { ensureDefaultRulesWhenNoCategories } from "@/lib/defaultCategoryRules";
import type { Prisma } from "@/generated/prisma/client";
import {
  matchLiability,
  matchPlannedExpense,
  matchRecurringIncome,
  matchSubscription,
} from "@/lib/recurringMatcher";
import { applyLiabilityPayment } from "@/lib/liabilityBalance";
import {
  mergeLiabilityLinkTag,
  mergePlannedExpenseLinkTag,
  mergeRecurringIncomeLinkTag,
  mergeSubscriptionLinkTag,
} from "@/lib/transactionTags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SessionBankSource = "sberbank" | "tbank";

export type ImportBankOverlapBody = {
  warning: "overlap";
  message: string;
  overlappingSession: {
    id: string;
    fileName: string;
    dateFrom: string;
    dateTo: string;
    totalCount: number;
    createdAt: string;
  };
};

function normalizedBankSource(bankRaw: string): SessionBankSource {
  return bankRaw === "tbank" ? "tbank" : "sberbank";
}

function dateRangeFromTransactions(transactions: ParsedTransaction[]): { dateFrom: Date; dateTo: Date } {
  const times = transactions.map((t) => t.date.getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  return { dateFrom: new Date(min), dateTo: new Date(max) };
}

async function findOverlappingImportSession(
  vaultId: string,
  bankSource: SessionBankSource,
  dateFrom: Date,
  dateTo: Date
) {
  return prisma.importSession.findFirst({
    where: {
      vaultId,
      bankSource,
      dateFrom: { lte: dateTo },
      dateTo: { gte: dateFrom },
    },
    select: {
      id: true,
      fileName: true,
      dateFrom: true,
      dateTo: true,
      totalCount: true,
      createdAt: true,
    },
  });
}

function formatRuRangeShort(from: Date, to: Date): string {
  const fmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" });
  return `${fmt.format(from)}–${fmt.format(to)}`;
}

type ImportResolvedType = "income" | "expense" | "transfer";

/** Индекс строки в массиве распарсенных операций → выбранный тип после классификации */
type ClassificationPayload = Partial<Record<number, ImportResolvedType>>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseClassificationsField(raw: string | null | undefined): ClassificationPayload {
  if (raw == null || raw.trim() === "") return {};
  try {
    const obj: unknown = JSON.parse(raw);
    if (!isPlainObject(obj)) return {};
    const out: ClassificationPayload = {};
    for (const [k, v] of Object.entries(obj)) {
      const idx = Number(k);
      if (!Number.isInteger(idx) || idx < 0) continue;
      if (v === "income" || v === "expense" || v === "transfer") {
        out[idx] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function resolveImportType(
  row: ParsedTransaction,
  index: number,
  classifications: ClassificationPayload
): ImportResolvedType {
  if (row.needsClassification) {
    const c = classifications[index];
    if (c === "income" || c === "expense" || c === "transfer") return c;
    return row.type;
  }
  return row.type;
}

type ParsedBatch = {
  transactions: ParsedTransaction[];
  errors: string[];
  skippedByStatus: number;
};

export type ImportBankResponseBody = {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
  /** Автопривязка к RecurringIncome / Subscription при импорте */
  autoLinked: number;
  /** Категория по правилам CategoryRule (после categoryMapper) */
  autoCategorized: number;
};

function normalizeNote(note: string): string {
  return note.trim().replace(/\s+/g, " ");
}

type TxClient = Prisma.TransactionClient;

async function existsDuplicateForImport(
  tx: TxClient,
  vaultId: string,
  date: Date,
  amountAbs: number,
  description: string
): Promise<boolean> {
  const start = new Date(date);
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  const want = normalizeNote(description);
  const rows = await tx.transaction.findMany({
    where: {
      amount: amountAbs,
      date: { gte: start, lte: end },
      OR: [{ fromVaultId: vaultId }, { toVaultId: vaultId }],
    },
    select: { note: true },
  });
  return rows.some((r) => normalizeNote(r.note ?? "") === want);
}

async function applyManualVaultDelta(tx: TxClient, vaultId: string | null, delta: number): Promise<void> {
  if (!vaultId) return;
  const vault = await tx.vault.findUnique({
    where: { id: vaultId },
    select: { balanceSource: true },
  });
  if (vault?.balanceSource === "MANUAL") {
    await tx.vault.update({
      where: { id: vaultId },
      data: { manualBalance: { increment: delta } },
    });
  }
}

function buildCreateInput(
  resolvedType: ImportResolvedType,
  parsed: ParsedTransaction,
  vaultId: string,
  categoryId: string | null,
  importSessionId: string
) {
  const amountAbs = Math.abs(parsed.amount);
  const currency = (parsed.currency ?? "RUB").trim().toUpperCase() || "RUB";
  const note = parsed.description;

  if (resolvedType === "income") {
    return {
      type: "income" as const,
      amount: amountAbs,
      date: parsed.date,
      currency,
      fromVaultId: null as string | null,
      toVaultId: vaultId,
      categoryId,
      note,
      importSessionId,
    };
  }
  if (resolvedType === "expense") {
    return {
      type: "expense" as const,
      amount: amountAbs,
      date: parsed.date,
      currency,
      fromVaultId: vaultId,
      toVaultId: null as string | null,
      categoryId,
      note,
      importSessionId,
    };
  }
  return {
    type: "transfer" as const,
    amount: amountAbs,
    date: parsed.date,
    currency,
    fromVaultId: vaultId,
    toVaultId: vaultId,
    categoryId,
    note,
    importSessionId,
  };
}

type CreateInput = ReturnType<typeof buildCreateInput>;

async function applyEffectsForCreated(tx: TxClient, input: CreateInput): Promise<void> {
  if (input.type === "income") {
    await applyManualVaultDelta(tx, input.toVaultId, input.amount);
  } else if (input.type === "expense") {
    await applyManualVaultDelta(tx, input.fromVaultId, -input.amount);
  } else {
    await applyManualVaultDelta(tx, input.fromVaultId, -input.amount);
    await applyManualVaultDelta(tx, input.toVaultId, input.amount);
  }
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ImportBankResponseBody | ImportBankOverlapBody>> {
  const fail = (status: number, errors: string[]) =>
    NextResponse.json(
      { imported: 0, skipped: 0, duplicates: 0, errors, autoLinked: 0, autoCategorized: 0 },
      { status }
    );

  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const bankRaw = formData.get("bank")?.toString();
    const vaultId = formData.get("vaultId")?.toString().trim();
    const skipRaw = formData.get("skipDuplicates")?.toString();
    const skipDuplicates = skipRaw !== "false" && skipRaw !== "0";
    const forceImport = formData.get("forceImport")?.toString() === "true";
    const classifications = parseClassificationsField(formData.get("classifications")?.toString());

    if (!vaultId) {
      return fail(400, ["Укажите хранилище."]);
    }
    if (bankRaw !== "sberbank" && bankRaw !== "tbank" && bankRaw !== "sberbank-pdf") {
      return fail(400, ["Некорректный банк. Ожидается sberbank, sberbank-pdf или tbank."]);
    }

    if (!(fileEntry instanceof File)) {
      return fail(400, ["Файл не передан или имеет неверный формат поля file."]);
    }

    const buf = await fileEntry.arrayBuffer();
    const name = fileEntry.name.toLowerCase();
    const isPdf = name.endsWith(".pdf");
    const isCsv = name.endsWith(".csv");

    let parsed: ParsedBatch;
    try {
      if (bankRaw === "tbank") {
        if (!isCsv) return fail(400, ["Т-Банк: загрузите файл CSV."]);
        parsed = parseTbankCsv(buf);
      } else if (bankRaw === "sberbank-pdf") {
        if (!isPdf) return fail(400, ["Для режима sberbank-pdf нужен файл .pdf."]);
        parsed = await parseSberbankPdf(buf);
      } else if (bankRaw === "sberbank") {
        if (isPdf) {
          parsed = await parseSberbankPdf(buf);
        } else if (isCsv) {
          parsed = parseSberbankCsv(buf);
        } else {
          return fail(400, ["Сбербанк: загрузите PDF или CSV выписку."]);
        }
      } else {
        return fail(400, ["Некорректный банк."]);
      }
    } catch (e) {
      if (e instanceof SberbankPdfParseError) {
        return fail(400, [e.message]);
      }
      throw e;
    }

    const skipped = parsed.skippedByStatus;

    const vault = await prisma.vault.findUnique({
      where: { id: vaultId },
      select: { id: true, name: true, isActive: true, balanceSource: true },
    });
    if (!vault || !vault.isActive) {
      return fail(400, ["Хранилище не найдено или неактивно."]);
    }
    if (vault.balanceSource === "ASSETS") {
      return fail(400, [
        `Хранилище «${vault.name}» привязано к активам. Импорт в него недоступен — выберите счёт с ручным балансом.`,
      ]);
    }

    if (parsed.transactions.length === 0) {
      const hint =
        parsed.errors.length > 0
          ? parsed.errors.slice(0, 8)
          : ["Не удалось извлечь ни одной операции. Проверьте формат файла и выбранный банк."];
      return fail(400, hint);
    }

    for (let i = 0; i < parsed.transactions.length; i++) {
      const row = parsed.transactions[i];
      if (!row.needsClassification) continue;
      const c = classifications[i];
      if (c !== "income" && c !== "expense" && c !== "transfer") {
        return fail(400, [
          "Для операций с типом «перевод» нужна классификация: передайте поле classifications (JSON) с типом для каждой такой строки по индексу.",
        ]);
      }
    }

    const sessionBank = normalizedBankSource(bankRaw ?? "");
    const { dateFrom, dateTo } = dateRangeFromTransactions(parsed.transactions);

    if (!forceImport) {
      const overlap = await findOverlappingImportSession(vaultId, sessionBank, dateFrom, dateTo);
      if (overlap) {
        const bankName = sessionBank === "tbank" ? "Т-Банка" : "Сбербанка";
        const period = formatRuRangeShort(overlap.dateFrom, overlap.dateTo);
        const body: ImportBankOverlapBody = {
          warning: "overlap",
          message: `Найден предыдущий импорт за период ${period} из ${bankName}. Транзакции за пересекающийся период будут пропущены как дубли.`,
          overlappingSession: {
            id: overlap.id,
            fileName: overlap.fileName,
            dateFrom: overlap.dateFrom.toISOString(),
            dateTo: overlap.dateTo.toISOString(),
            totalCount: overlap.totalCount,
            createdAt: overlap.createdAt.toISOString(),
          },
        };
        return NextResponse.json(body, { status: 200 });
      }
    }

    await ensureDefaultRulesWhenNoCategories(prisma);

    const resolveCategory = await createImportedCategoryResolver(prisma);

    const activeRules = await prisma.categoryRule.findMany({
      where: { isActive: true },
      include: { category: true },
    });
    const rulesSorted = sortRulesForMatching(activeRules);

    const [recurringIncomes, subscriptions, unpaidPlanned, activeLiabilities] = await Promise.all([
      prisma.recurringIncome.findMany({ where: { isActive: true } }),
      prisma.subscription.findMany({ where: { isActive: true } }),
      prisma.plannedExpense.findMany({ where: { isPaid: false } }),
      prisma.liability.findMany({
        where: { isActive: true, currentBalance: { gt: 0 } },
      }),
    ]);

    let imported = 0;
    let duplicates = 0;
    let autoLinked = 0;
    let autoCategorized = 0;
    const errors = [...parsed.errors];

    /** Импорт может быть длинным (много строк × проверка дубликатов + create); дефолт Prisma 5s не хватает. */
    const IMPORT_TX_TIMEOUT_MS = 120_000;

    await prisma.$transaction(
      async (tx) => {
        const importSession = await tx.importSession.create({
          data: {
            bankSource: sessionBank,
            fileName: fileEntry.name,
            dateFrom,
            dateTo,
            vaultId,
            totalCount: 0,
            skippedCount: 0,
          },
        });
        const sessionId = importSession.id;

        for (let i = 0; i < parsed.transactions.length; i++) {
          const row = parsed.transactions[i];
          const amountAbs = Math.abs(row.amount);
          if (skipDuplicates) {
            const dup = await existsDuplicateForImport(tx, vaultId, row.date, amountAbs, row.description);
            if (dup) {
              duplicates += 1;
              continue;
            }
          }

          let categoryId = resolveCategory(row.rawCategory);
          let ruleIdForMatch: string | null = null;
          if (!categoryId && !isDescriptionExcludedFromAutoCategory(row.description)) {
            const hit = matchCategoryRule(row.description, rulesSorted);
            if (hit) {
              categoryId = hit.categoryId;
              ruleIdForMatch = hit.id;
            }
          }
          const resolvedType = resolveImportType(row, i, classifications);
          const data = buildCreateInput(resolvedType, row, vaultId, categoryId, sessionId);

          const created = await tx.transaction.create({ data });
          await applyEffectsForCreated(tx, data);
          imported += 1;

          if (ruleIdForMatch) {
            await tx.categoryRule.update({
              where: { id: ruleIdForMatch },
              data: { matchCount: { increment: 1 } },
            });
            autoCategorized += 1;
          }

          if (created.type === "income" && created.toVaultId) {
            const m = matchRecurringIncome(
              {
                type: created.type,
                amount: created.amount,
                date: created.date,
                note: created.note ?? "",
                toVaultId: created.toVaultId,
              },
              recurringIncomes
            );
            if (m) {
              await tx.transaction.update({
                where: { id: created.id },
                data: {
                  recurringIncomeId: m.id,
                  tags: mergeRecurringIncomeLinkTag(created.tags),
                },
              });
              autoLinked += 1;
            }
          } else if (created.type === "expense" && created.fromVaultId) {
            const mSub = matchSubscription(
              {
                type: created.type,
                amount: created.amount,
                date: created.date,
                note: created.note ?? "",
                fromVaultId: created.fromVaultId,
              },
              subscriptions
            );
            if (mSub) {
              await tx.transaction.update({
                where: { id: created.id },
                data: {
                  subscriptionId: mSub.id,
                  tags: mergeSubscriptionLinkTag(created.tags),
                },
              });
              autoLinked += 1;
            } else {
              const mPlan = matchPlannedExpense(
                {
                  type: created.type,
                  amount: created.amount,
                  date: created.date,
                  note: created.note ?? "",
                  currency: created.currency,
                  fromVaultId: created.fromVaultId,
                },
                unpaidPlanned
              );
              if (mPlan) {
                await tx.transaction.update({
                  where: { id: created.id },
                  data: {
                    plannedExpenseId: mPlan.id,
                    tags: mergePlannedExpenseLinkTag(created.tags),
                  },
                });
                await tx.plannedExpense.update({
                  where: { id: mPlan.id },
                  data: { isPaid: true },
                });
                const stale = unpaidPlanned.find((p) => p.id === mPlan.id);
                if (stale) stale.isPaid = true;
                autoLinked += 1;
              } else {
                const mLiab = matchLiability(
                  {
                    type: created.type,
                    amount: created.amount,
                    date: created.date,
                    note: created.note ?? "",
                    currency: created.currency,
                    fromVaultId: created.fromVaultId,
                  },
                  activeLiabilities
                );
                if (mLiab) {
                  await tx.transaction.update({
                    where: { id: created.id },
                    data: {
                      liabilityId: mLiab.id,
                      tags: mergeLiabilityLinkTag(created.tags),
                    },
                  });
                  await applyLiabilityPayment(tx, mLiab.id, created.amount, created.currency);
                  const staleL = activeLiabilities.find((l) => l.id === mLiab.id);
                  if (staleL) {
                    staleL.currentBalance = Math.max(0, staleL.currentBalance - created.amount);
                  }
                  autoLinked += 1;
                }
              }
            }
          }
        }

        await tx.importSession.update({
          where: { id: sessionId },
          data: {
            totalCount: imported,
            skippedCount: duplicates,
          },
        });
      },
      { timeout: IMPORT_TX_TIMEOUT_MS, maxWait: 15_000 }
    );

    revalidatePath("/transactions");
    revalidatePath("/vaults");
    revalidatePath("/");
    revalidatePath("/import");
    revalidatePath("/goals");
    revalidatePath("/liabilities");

    return NextResponse.json({
      imported,
      skipped,
      duplicates,
      errors: errors.slice(0, 50),
      autoLinked,
      autoCategorized,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Сбой при импорте.";
    return fail(500, [msg]);
  }
}
