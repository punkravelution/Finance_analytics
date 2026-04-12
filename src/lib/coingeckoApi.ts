const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Запрос к CoinGecko с повтором при 429 (используется курсами и поиском монет). */
export async function fetchWithRateLimitRetry(url: string): Promise<Response> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, { cache: "no-store" });
    if (response.status !== 429) return response;

    if (attempt === maxAttempts) {
      throw new Error("CoinGecko временно ограничил запросы (HTTP 429). Попробуйте через 1-2 минуты.");
    }

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = Number.parseInt(retryAfterHeader ?? "", 10);
    const delayMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : attempt * 1500;

    await sleep(delayMs);
  }

  throw new Error("CoinGecko временно недоступен");
}

/** CoinGecko coin id: строчные буквы, цифры, дефис, подчёркивание, точка (без / для SSRF). */
export function isValidCoinGeckoId(id: string): boolean {
  return id.length > 0 && id.length <= 160 && /^[a-z0-9][a-z0-9._-]*$/.test(id);
}

export interface CoinGeckoSearchCoin {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
}

/** Поиск монет (не биржи) по строке запроса. */
export async function coinGeckoSearchCoins(query: string): Promise<CoinGeckoSearchCoin[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = `${COINGECKO_BASE}/search?query=${encodeURIComponent(q)}`;
  let response: Response;
  try {
    response = await fetchWithRateLimitRetry(url);
  } catch {
    return [];
  }
  if (!response.ok) return [];

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return [];
  }

  if (typeof json !== "object" || json === null || !("coins" in json)) return [];
  const coinsRaw = (json as { coins?: unknown }).coins;
  if (!Array.isArray(coinsRaw)) return [];

  const out: CoinGeckoSearchCoin[] = [];
  for (const row of coinsRaw) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const name = typeof r.name === "string" ? r.name : "";
    const sym = typeof r.symbol === "string" ? r.symbol : "";
    if (!id || !name || !sym) continue;
    const rank = typeof r.market_cap_rank === "number" ? r.market_cap_rank : null;
    out.push({
      id,
      name,
      symbol: sym.toUpperCase(),
      market_cap_rank: rank,
    });
    if (out.length >= 15) break;
  }
  return out;
}

export async function coinGeckoSimplePriceRubUsd(
  coinId: string
): Promise<{ rub: number | null; usd: number | null }> {
  if (!isValidCoinGeckoId(coinId)) return { rub: null, usd: null };

  const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=rub,usd`;
  let response: Response;
  try {
    response = await fetchWithRateLimitRetry(url);
  } catch {
    return { rub: null, usd: null };
  }
  if (!response.ok) return { rub: null, usd: null };

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { rub: null, usd: null };
  }
  if (typeof json !== "object" || json === null) return { rub: null, usd: null };
  const row = (json as Record<string, { rub?: number; usd?: number } | undefined>)[coinId];
  if (!row) return { rub: null, usd: null };

  const rub = typeof row.rub === "number" && Number.isFinite(row.rub) && row.rub > 0 ? row.rub : null;
  const usd = typeof row.usd === "number" && Number.isFinite(row.usd) && row.usd > 0 ? row.usd : null;
  return { rub, usd };
}

const SIMPLE_PRICE_CHUNK = 40;

/** Курсы RUB/USD для нескольких монет (ids через запятую, чанками). */
export async function coinGeckoSimplePriceRubUsdMany(
  coinIds: string[]
): Promise<Map<string, { rub: number | null; usd: number | null }>> {
  const out = new Map<string, { rub: number | null; usd: number | null }>();
  const unique = [...new Set(coinIds.filter(isValidCoinGeckoId))];
  if (unique.length === 0) return out;

  for (let i = 0; i < unique.length; i += SIMPLE_PRICE_CHUNK) {
    const chunk = unique.slice(i, i + SIMPLE_PRICE_CHUNK);
    const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(chunk.join(","))}&vs_currencies=rub,usd`;
    let response: Response;
    try {
      response = await fetchWithRateLimitRetry(url);
    } catch {
      for (const id of chunk) out.set(id, { rub: null, usd: null });
      continue;
    }
    if (!response.ok) {
      for (const id of chunk) out.set(id, { rub: null, usd: null });
      continue;
    }
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      for (const id of chunk) out.set(id, { rub: null, usd: null });
      continue;
    }
    if (typeof json !== "object" || json === null) {
      for (const id of chunk) out.set(id, { rub: null, usd: null });
      continue;
    }
    const payload = json as Record<string, { rub?: number; usd?: number } | undefined>;
    for (const id of chunk) {
      const row = payload[id];
      if (!row) {
        out.set(id, { rub: null, usd: null });
        continue;
      }
      const rub =
        typeof row.rub === "number" && Number.isFinite(row.rub) && row.rub > 0 ? row.rub : null;
      const usd =
        typeof row.usd === "number" && Number.isFinite(row.usd) && row.usd > 0 ? row.usd : null;
      out.set(id, { rub, usd });
    }
  }
  return out;
}
