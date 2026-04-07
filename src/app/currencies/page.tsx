import Link from "next/link";
import { Coins } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyCreateForm } from "@/components/currencies/CurrencyCreateForm";
import { ExchangeRateUpsertForm } from "@/components/currencies/ExchangeRateUpsertForm";

export const dynamic = "force-dynamic";

export default async function CurrenciesPage() {
  const [currencies, rates] = await Promise.all([
    prisma.currency.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
    prisma.exchangeRate.findMany({
      orderBy: { date: "desc" },
      take: 50,
    }),
  ]);

  const latestByPair = new Map<string, (typeof rates)[number]>();
  for (const r of rates) {
    const key = `${r.fromCurrency}-${r.toCurrency}`;
    if (!latestByPair.has(key)) latestByPair.set(key, r);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Coins size={22} className="text-yellow-400" />
          Валюты
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Справочник валют и ручное управление курсами
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Добавить валюту</CardTitle>
        </CardHeader>
        <CardContent>
          <CurrencyCreateForm />
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
          <ExchangeRateUpsertForm
            currencies={currencies.map((c) => ({ code: c.code, name: c.name }))}
          />
          <div className="space-y-2">
            {Array.from(latestByPair.values()).map((r) => (
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
            {latestByPair.size === 0 && (
              <p className="text-sm text-slate-500">Курсов пока нет</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
