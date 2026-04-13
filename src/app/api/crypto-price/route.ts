import { NextRequest, NextResponse } from "next/server";
import {
  coinGeckoSimplePriceRubUsd,
  coinGeckoSimplePriceRubUsdMany,
  isValidCoinGeckoId,
} from "@/lib/coingeckoApi";

export const runtime = "nodejs";
const CRYPTO_REVALIDATE_SECONDS = 180;

export async function GET(request: NextRequest) {
  const idsRaw = request.nextUrl.searchParams.get("ids")?.trim() ?? "";
  if (idsRaw) {
    const ids = [...new Set(idsRaw.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))];
    if (ids.length === 0 || ids.length > 80 || ids.some((id) => !isValidCoinGeckoId(id))) {
      return NextResponse.json({ error: "Некорректный список ids" }, { status: 400 });
    }
    try {
      const quotes = await coinGeckoSimplePriceRubUsdMany(ids);
      const result: Record<string, { rub: number | null; usd: number | null }> = {};
      for (const id of ids) {
        result[id] = quotes.get(id) ?? { rub: null, usd: null };
      }
      return NextResponse.json(result, {
        headers: {
          "Cache-Control": `public, s-maxage=${CRYPTO_REVALIDATE_SECONDS}, stale-while-revalidate=60`,
        },
      });
    } catch {
      return NextResponse.json({ error: "CoinGecko недоступен" }, { status: 502 });
    }
  }

  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id || !isValidCoinGeckoId(id)) {
    return NextResponse.json({ error: "Некорректный id монеты" }, { status: 400 });
  }

  try {
    const { rub, usd } = await coinGeckoSimplePriceRubUsd(id);
    if (rub == null && usd == null) {
      return NextResponse.json({ error: "Цена недоступна" }, { status: 404 });
    }
    return NextResponse.json(
      { rub, usd },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CRYPTO_REVALIDATE_SECONDS}, stale-while-revalidate=60`,
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "CoinGecko недоступен" }, { status: 502 });
  }
}
