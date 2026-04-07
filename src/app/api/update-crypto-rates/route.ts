import { NextResponse } from "next/server";
import { updateCryptoRates } from "@/lib/fetchCryptoRates";

export const runtime = "nodejs";

export async function POST() {
  try {
    const updated = await updateCryptoRates();
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить курсы крипты";
    console.error("[update-crypto-rates] failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
