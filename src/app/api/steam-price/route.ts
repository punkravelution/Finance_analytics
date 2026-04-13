import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const STEAM_REVALIDATE_SECONDS = 60;

function parseSteamPrice(value: string): number | null {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");

  const num = Number(normalized);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

export async function GET(request: NextRequest) {
  const hashName = request.nextUrl.searchParams.get("hash_name") ?? "";
  if (!hashName) {
    return NextResponse.json({ price: null }, { status: 400 });
  }

  const url = new URL("https://steamcommunity.com/market/priceoverview/");
  url.searchParams.set("appid", "730");
  url.searchParams.set("currency", "5");
  url.searchParams.set("market_hash_name", hashName);

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: STEAM_REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      return NextResponse.json({ price: null }, { status: 503 });
    }

    const json = (await response.json()) as {
      success?: boolean;
      lowest_price?: string;
      median_price?: string;
    };

    const sourcePrice = json.lowest_price ?? json.median_price ?? "";
    const price = parseSteamPrice(sourcePrice);
    return NextResponse.json(
      { price },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${STEAM_REVALIDATE_SECONDS}, stale-while-revalidate=60`,
        },
      }
    );
  } catch {
    return NextResponse.json({ price: null }, { status: 503 });
  }
}
