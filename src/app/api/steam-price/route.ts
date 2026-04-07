import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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
    const response = await fetch(url.toString(), { cache: "no-store" });
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
    return NextResponse.json({ price });
  } catch {
    return NextResponse.json({ price: null }, { status: 503 });
  }
}
