import { prisma } from "@/lib/prisma";
import { coinGeckoSimplePriceRubUsdMany } from "@/lib/coingeckoApi";

/** Встроенный список: id CoinGecko → тикер в приложении */
const ID_TO_TICKER: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  litecoin: "LTC",
  tether: "USDT",
  binancecoin: "BNB",
  solana: "SOL",
};

const BUILTIN_COIN_IDS = Object.keys(ID_TO_TICKER);

function getRatesDate(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** id монеты → код валюты в справочнике (встроенные + из БД). */
async function buildCoinIdToTickerMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const id of BUILTIN_COIN_IDS) {
    map.set(id, ID_TO_TICKER[id]!);
  }
  const fromDb = await prisma.currency.findMany({
    where: { coinGeckoId: { not: null }, isActive: true },
    select: { code: true, coinGeckoId: true },
  });
  for (const row of fromDb) {
    if (row.coinGeckoId) {
      map.set(row.coinGeckoId, row.code.toUpperCase());
    }
  }
  return map;
}

export async function updateCryptoRates(): Promise<number> {
  const idToTicker = await buildCoinIdToTickerMap();
  const allIds = [...idToTicker.keys()];
  const prices = await coinGeckoSimplePriceRubUsdMany(allIds);

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

  for (const coinId of allIds) {
    const ticker = idToTicker.get(coinId);
    if (!ticker) continue;
    const quote = prices.get(coinId);
    if (!quote) continue;

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
