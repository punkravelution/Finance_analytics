import { NextRequest, NextResponse } from "next/server";
import { coinGeckoSimplePriceRubUsd, isValidCoinGeckoId } from "@/lib/coingeckoApi";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id || !isValidCoinGeckoId(id)) {
    return NextResponse.json({ error: "Некорректный id монеты" }, { status: 400 });
  }

  try {
    const { rub, usd } = await coinGeckoSimplePriceRubUsd(id);
    if (rub == null && usd == null) {
      return NextResponse.json({ error: "Цена недоступна" }, { status: 404 });
    }
    return NextResponse.json({ rub, usd });
  } catch {
    return NextResponse.json({ error: "CoinGecko недоступен" }, { status: 502 });
  }
}
