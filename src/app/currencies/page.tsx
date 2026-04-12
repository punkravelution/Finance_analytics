import Link from "next/link";
import { Coins } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyCreateForm } from "@/components/currencies/CurrencyCreateForm";
import { CryptoCurrencyCreateForm } from "@/components/currencies/CryptoCurrencyCreateForm";
import { ExchangeRateUpsertForm } from "@/components/currencies/ExchangeRateUpsertForm";
import { CbrRatesUpdateForm } from "@/components/currencies/CbrRatesUpdateForm";
import { CryptoRatesUpdateForm } from "@/components/currencies/CryptoRatesUpdateForm";

export const dynamic = "force-dynamic";

function sourcePriority(source: string): number {
  if (source === "cbr" || source === "coingecko") return 2;
  if (source === "manual") return 1;
  return 0;
}

export default async function CurrenciesPage() {
  const [currencies, rates, lastCbrRate, lastCoinGeckoRate, usedVaultCurrencies, usedAssetCurrencies, usedTransactionCurrencies, usedIncomeCurrencies, usedSubscriptionCurrencies, usedLiabilityCurrencies] = await Promise.all([
    prisma.currency.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
    prisma.exchangeRate.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.exchangeRate.findFirst({
      where: { source: "cbr" },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
    prisma.exchangeRate.findFirst({
      where: { source: "coingecko" },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
    prisma.vault.findMany({
      distinct: ["currency"],
      select: { currency: true },
    }),
    prisma.asset.findMany({
      distinct: ["currency"],
      select: { currency: true },
    }),
    prisma.transaction.findMany({
      distinct: ["currency"],
      select: { currency: true },
    }),
    prisma.incomeEvent.findMany({
      distinct: ["currency"],
      select: { currency: true },
    }),
    prisma.subscription.findMany({
      distinct: ["currency"],
      select: { currency: true },
    }),
    prisma.liability.findMany({
      distinct: ["currency"],
      select: { currency: true },
    }),
  ]);

  const latestByPair = new Map<string, (typeof rates)[number]>();
  for (const r of rates) {
    const key = `${r.fromCurrency}-${r.toCurrency}`;
    const existing = latestByPair.get(key);
    if (!existing) {
      latestByPair.set(key, r);
      continue;
    }

    const currentPriority = sourcePriority(r.source);
    const existingPriority = sourcePriority(existing.source);
    const isNewer =
      r.date.getTime() > existing.date.getTime() ||
      (r.date.getTime() === existing.date.getTime() &&
        r.createdAt.getTime() > existing.createdAt.getTime());

    if (currentPriority > existingPriority || (currentPriority === existingPriority && isNewer)) {
      latestByPair.set(key, r);
    }
  }

  const usedCurrencyCodes = new Set(
    [
      ...usedVaultCurrencies.map((x) => x.currency),
      ...usedAssetCurrencies.map((x) => x.currency),
      ...usedTransactionCurrencies.map((x) => x.currency),
      ...usedIncomeCurrencies.map((x) => x.currency),
      ...usedSubscriptionCurrencies.map((x) => x.currency),
      ...usedLiabilityCurrencies.map((x) => x.currency),
    ]
      .filter(Boolean)
      .map((code) => code.toUpperCase())
  );
  usedCurrencyCodes.add("RUB");

  const filteredLatestRates = Array.from(latestByPair.values()).filter(
    (r) => usedCurrencyCodes.has(r.fromCurrency) && usedCurrencyCodes.has(r.toCurrency)
  );

  const lastUpdatedLabel = lastCbrRate
    ? new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(lastCbrRate.date)
    : "ещё не обновлялось";
  const lastCryptoUpdatedLabel = lastCoinGeckoRate
    ? new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(lastCoinGeckoRate.date)
    : "ещё не обновлялось";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Coins size={22} className="text-yellow-400" />
          Валюты
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Фиат из выгрузки ЦБ РФ, криптовалюты через CoinGecko и ручное управление курсами
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Добавить валюту (ЦБ РФ)</CardTitle>
        </CardHeader>
        <CardContent>
          <CurrencyCreateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Добавить криптовалюту (CoinGecko)</CardTitle>
        </CardHeader>
        <CardContent>
          <CryptoCurrencyCreateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Справочник валют</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {currencies.map((c) => (
              <div
                key={c.code}
                className="flex items-center justify-between p-3 rounded-lg border border-[hsl(216,34%,17%)]"
              >
                <div>
                  <p className="text-sm text-white">
                    {c.code} · {c.name} ({c.symbol})
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.isActive ? "Активна" : "Неактивна"} · sortOrder: {c.sortOrder}
                    {c.coinGeckoId ? ` · CoinGecko: ${c.coinGeckoId}` : ""}
                  </p>
                </div>
                <Link
                  href={`/currencies/${c.code}/edit`}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Редактировать
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Курсы валют</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CbrRatesUpdateForm lastUpdatedLabel={lastUpdatedLabel} />
          <CryptoRatesUpdateForm lastUpdatedLabel={lastCryptoUpdatedLabel} />
          <ExchangeRateUpsertForm
            currencies={currencies.map((c) => ({ code: c.code, name: c.name }))}
          />
          <div className="space-y-2">
            {filteredLatestRates.map((r) => (
              <div
                key={`${r.fromCurrency}-${r.toCurrency}`}
                className="flex items-center justify-between text-sm border-b border-[hsl(216,34%,13%)] pb-2"
              >
                <span className="text-slate-300">
                  {r.fromCurrency} → {r.toCurrency}
                </span>
                <span className="text-white font-mono">{r.rate}</span>
              </div>
            ))}
            {filteredLatestRates.length === 0 && (
              <p className="text-sm text-slate-500">Курсов пока нет</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
