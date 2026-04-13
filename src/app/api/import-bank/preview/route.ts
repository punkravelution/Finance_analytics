import { NextRequest, NextResponse } from "next/server";
import { parseSberbankPdf, SberbankPdfParseError } from "@/lib/bankParsers/sberbank-pdf";
import { parseTbankPdf, TbankPdfParseError } from "@/lib/bankParsers/tbank-pdf";
import type { ParsedTransaction } from "@/lib/bankParsers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Сериализация дат для JSON (клиент восстанавливает через new Date). */
function serializeTransactions(rows: ParsedTransaction[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    ...r,
    date: r.date.toISOString(),
  }));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const bankRaw = formData.get("bank")?.toString();
    const bank = bankRaw === "tbank" ? "tbank" : "sberbank";
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ errors: ["Файл не передан."] }, { status: 400 });
    }
    if (!fileEntry.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ errors: ["Для предпросмотра нужен PDF."] }, { status: 400 });
    }
    const buf = await fileEntry.arrayBuffer();
    const parsed = bank === "tbank" ? await parseTbankPdf(buf) : await parseSberbankPdf(buf);
    return NextResponse.json({
      transactions: serializeTransactions(parsed.transactions),
      errors: parsed.errors,
    });
  } catch (e) {
    if (e instanceof SberbankPdfParseError) {
      return NextResponse.json({ transactions: [], errors: [e.message] }, { status: 400 });
    }
    if (e instanceof TbankPdfParseError) {
      return NextResponse.json({ transactions: [], errors: [e.message] }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Ошибка предпросмотра.";
    return NextResponse.json({ transactions: [], errors: [msg] }, { status: 500 });
  }
}
