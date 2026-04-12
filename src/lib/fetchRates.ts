import { prisma } from "@/lib/prisma";
import { fetchCbrDailyXml, parseXmlDate, parseValutes } from "@/lib/cbrXml";

export async function updateExchangeRates(): Promise<number> {
  const xml = await fetchCbrDailyXml();
  const date = parseXmlDate(xml);
  const valutes = parseValutes(xml).filter((r) => /^[A-Z]{3}$/.test(r.code) && r.code !== "RUB");

  if (valutes.length === 0) {
    throw new Error("ЦБ РФ вернул пустой список курсов");
  }

  let updatedCount = 0;
  const managedPairs: Array<{ fromCurrency: string; toCurrency: string }> = [];

  const saveRate = async (fromCurrency: string, toCurrency: string, value: number) => {
    const existing = await prisma.exchangeRate.findFirst({
      where: { fromCurrency, toCurrency, date },
      select: { id: true },
    });

    if (existing) {
      await prisma.exchangeRate.update({
        where: { id: existing.id },
        data: {
          rate: value,
          source: "cbr",
        },
      });
    } else {
      await prisma.exchangeRate.create({
        data: {
          fromCurrency,
          toCurrency,
          rate: value,
          date,
          source: "cbr",
        },
      });
    }

    updatedCount += 1;
  };

  for (const rate of valutes) {
    const rubPerOne = rate.value / rate.nominal;
    const inverse = 1 / rubPerOne;

    managedPairs.push({ fromCurrency: rate.code, toCurrency: "RUB" });
    managedPairs.push({ fromCurrency: "RUB", toCurrency: rate.code });

    await saveRate(rate.code, "RUB", rubPerOne);
    await saveRate("RUB", rate.code, inverse);
  }

  if (managedPairs.length > 0) {
    await prisma.exchangeRate.deleteMany({
      where: {
        source: { not: "cbr" },
        OR: managedPairs,
      },
    });
  }

  return updatedCount;
}
