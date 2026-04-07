import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

async function fetchLastPrice(ticker: string): Promise<number | null> {
  const url =
    `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${ticker}.json` +
    "?iss.meta=off&iss.only=marketdata&marketdata.columns=SECID,LAST";
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;

  const json = (await response.json()) as {
    marketdata?: { data?: Array<[string, number | null]> };
  };
  return json.marketdata?.data?.[0]?.[1] ?? null;
}

async function fetchPrevPrice(ticker: string): Promise<number | null> {
  const url =
    `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${ticker}.json` +
    "?iss.meta=off&iss.only=securities&securities.columns=SECID,PREVPRICE";
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;

  const json = (await response.json()) as {
    securities?: { data?: Array<[string, number | null]> };
  };
  return json.securities?.data?.[0]?.[1] ?? null;
}

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "Тикер не найден" }, { status: 404 });
  }

  try {
    const last = await fetchLastPrice(ticker);
    const price = last ?? (await fetchPrevPrice(ticker));

    if (price == null || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Тикер не найден" }, { status: 404 });
    }

    return NextResponse.json({ price, ticker });
  } catch {
    return NextResponse.json({ error: "Тикер не найден" }, { status: 404 });
  }
}
