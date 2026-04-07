import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type SteamSearchItem = {
  name: string;
  hash_name: string;
  sell_price_text?: string;
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json([]);

  const url = new URL("https://steamcommunity.com/market/search/render/");
  url.searchParams.set("query", q);
  url.searchParams.set("appid", "730");
  url.searchParams.set("norender", "1");
  url.searchParams.set("count", "10");

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) return NextResponse.json([]);

    const json = (await response.json()) as { results?: SteamSearchItem[] };
    const results = (json.results ?? []).map((item) => ({
      name: item.name,
      hash_name: item.hash_name,
      price: item.sell_price_text ?? "",
    }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
