import { prisma } from "@/lib/prisma";

type CurrencyOption = {
  code: string;
  name: string;
  symbol: string;
};

const DEFAULT_CURRENCIES: CurrencyOption[] = [
  { code: "RUB", name: "Российский рубль", symbol: "₽" },
  { code: "USD", name: "Доллар США", symbol: "$" },
  { code: "EUR", name: "Евро", symbol: "€" },
  { code: "USDT", name: "Tether", symbol: "₮" },
];

export async function getActiveCurrenciesWithDefaults(): Promise<CurrencyOption[]> {
  const activeCurrencies = await prisma.currency.findMany({
    where: { isActive: true },
    select: { code: true, name: true, symbol: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  if (activeCurrencies.length > 0) {
    return activeCurrencies;
  }

  await Promise.all(
    DEFAULT_CURRENCIES.map((currency, index) =>
      prisma.currency.upsert({
        where: { code: currency.code },
        update: {
          isActive: true,
          name: currency.name,
          symbol: currency.symbol,
          sortOrder: index,
        },
        create: {
          ...currency,
          isActive: true,
          sortOrder: index,
        },
      })
    )
  );

  return prisma.currency.findMany({
    where: { isActive: true },
    select: { code: true, name: true, symbol: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}
