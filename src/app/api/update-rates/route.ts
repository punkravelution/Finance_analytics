import { NextResponse } from "next/server";
import { updateExchangeRates } from "@/lib/fetchRates";

export const runtime = "nodejs";

export async function POST() {
  try {
    const updated = await updateExchangeRates();
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить курсы";
    console.error("[update-rates] failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
