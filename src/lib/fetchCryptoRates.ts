import { prisma } from "@/lib/prisma";
import { fetchWithRateLimitRetry } from "@/lib/coingeckoApi";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin,tether,binancecoin,solana&vs_currencies=rub,usd";

const ID_TO_TICKER: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  litecoin: "LTC",
  tether: "USDT",
  binancecoin: "BNB",
  solana: "SOL",
};

type CoinGeckoResponse = Record<string, { rub?: number; usd?: number }>;

function getRatesDate(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function updateCryptoRates(): Promise<number> {
  let response: Response;
  try {
    response = await fetchWithRateLimitRetry(COINGECKO_URL);
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error("Не удалось подключиться к API CoinGecko");
  }

  if (!response.ok) {
    throw new Error(`CoinGecko временно недоступен (HTTP ${response.status})`);
  }

  let payload: CoinGeckoResponse;
  try {
    payload = (await response.json()) as CoinGeckoResponse;
  } catch {
    throw new Error("Не удалось разобрать ответ CoinGecko");
  }

  const date = getRatesDate();
  let updatedCount = 0;
  const managedPairs: Array<{ fromCurrency: string; toCurrency: string }> = [];

  const saveRate = async (fromCurrency: string, toCurrency: string, rate: number) => {
    const existing = await prisma.exchangeRate.findFirst({
      where: { fromCurrency, toCurrency, date },
      select: { id: true },
    });

    if (existing) {
      await prisma.exchangeRate.update({
        where: { id: existing.id },
        data: { rate, source: "coingecko" },
      });
    } else {
      await prisma.exchangeRate.create({
        data: { fromCurrency, toCurrency, rate, date, source: "coingecko" },
      });
    }

    updatedCount += 1;
  };

  for (const [coinId, quote] of Object.entries(payload)) {
    const ticker = ID_TO_TICKER[coinId];
    if (!ticker) continue;

    if (typeof quote.rub === "number" && Number.isFinite(quote.rub) && quote.rub > 0) {
      managedPairs.push({ fromCurrency: ticker, toCurrency: "RUB" });
      managedPairs.push({ fromCurrency: "RUB", toCurrency: ticker });
      await saveRate(ticker, "RUB", quote.rub);
      await saveRate("RUB", ticker, 1 / quote.rub);
    }

    if (typeof quote.usd === "number" && Number.isFinite(quote.usd) && quote.usd > 0) {
      managedPairs.push({ fromCurrency: ticker, toCurrency: "USD" });
      managedPairs.push({ fromCurrency: "USD", toCurrency: ticker });
      await saveRate(ticker, "USD", quote.usd);
      await saveRate("USD", ticker, 1 / quote.usd);
    }
  }

  if (updatedCount === 0) {
    throw new Error("CoinGecko вернул пустой список курсов");
  }

  await prisma.exchangeRate.deleteMany({
    where: {
      source: { not: "coingecko" },
      OR: managedPairs,
    },
  });

  return updatedCount;
}
