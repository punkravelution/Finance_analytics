import { NextRequest, NextResponse } from "next/server";
import { coinGeckoSearchCoins } from "@/lib/coingeckoApi";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  try {
    const coins = await coinGeckoSearchCoins(q);
    return NextResponse.json(coins);
  } catch {
    return NextResponse.json([]);
  }
}
