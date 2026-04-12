import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseSberbankCsv } from "@/lib/bankParsers/sberbank";
import { parseSberbankPdf, SberbankPdfParseError } from "@/lib/bankParsers/sberbank-pdf";
import { parseTbankCsv } from "@/lib/bankParsers/tbank";
import { createImportedCategoryResolver } from "@/lib/bankParsers/categoryMapper";
import type { ParsedTransaction } from "@/lib/bankParsers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
};

function normalizeNote(note: string): string {
  return note.trim().replace(/\s+/g, " ");
}

interface TxClient {
  transaction: typeof prisma.transaction;
  vault: typeof prisma.vault;
}

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

function buildCreateInput(parsed: ParsedTransaction, vaultId: string, categoryId: string | null) {
  const amountAbs = Math.abs(parsed.amount);
  const currency = (parsed.currency ?? "RUB").trim().toUpperCase() || "RUB";
  const note = parsed.description;

  if (parsed.type === "income") {
    return {
      type: "income" as const,
      amount: amountAbs,
      date: parsed.date,
      currency,
      fromVaultId: null as string | null,
      toVaultId: vaultId,
      categoryId,
      note,
    };
  }
  if (parsed.type === "expense") {
    return {
      type: "expense" as const,
      amount: amountAbs,
      date: parsed.date,
      currency,
      fromVaultId: vaultId,
      toVaultId: null as string | null,
      categoryId,
      note,
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

export async function POST(request: NextRequest): Promise<NextResponse<ImportBankResponseBody>> {
  const fail = (status: number, errors: string[]) =>
    NextResponse.json({ imported: 0, skipped: 0, duplicates: 0, errors }, { status });

  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const bankRaw = formData.get("bank")?.toString();
    const vaultId = formData.get("vaultId")?.toString().trim();
    const skipRaw = formData.get("skipDuplicates")?.toString();
    const skipDuplicates = skipRaw !== "false" && skipRaw !== "0";

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

    const resolveCategory = await createImportedCategoryResolver(prisma);

    let imported = 0;
    let duplicates = 0;
    const errors = [...parsed.errors];

    /** Импорт может быть длинным (много строк × проверка дубликатов + create); дефолт Prisma 5s не хватает. */
    const IMPORT_TX_TIMEOUT_MS = 120_000;

    await prisma.$transaction(
      async (tx) => {
        const client = tx as TxClient;
        for (const row of parsed.transactions) {
          const amountAbs = Math.abs(row.amount);
          if (skipDuplicates) {
            const dup = await existsDuplicateForImport(client, vaultId, row.date, amountAbs, row.description);
            if (dup) {
              duplicates += 1;
              continue;
            }
          }

          const categoryId = resolveCategory(row.rawCategory);
          const data = buildCreateInput(row, vaultId, categoryId);

          await client.transaction.create({ data });
          await applyEffectsForCreated(client, data);
          imported += 1;
        }
      },
      { timeout: IMPORT_TX_TIMEOUT_MS, maxWait: 15_000 }
    );

    revalidatePath("/transactions");
    revalidatePath("/vaults");
    revalidatePath("/");

    return NextResponse.json({
      imported,
      skipped,
      duplicates,
      errors: errors.slice(0, 50),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Сбой при импорте.";
    return fail(500, [msg]);
  }
}
