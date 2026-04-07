import { prisma } from "@/lib/prisma";

const CBR_DAILY_URL = "https://www.cbr.ru/scripts/XML_daily.asp";
const TARGET_CURRENCIES = new Set(["RUB", "USD", "EUR"]);

type ParsedRate = {
  code: string;
  value: number;
  nominal: number;
};

function parseXmlDate(xml: string): Date {
  const dateMatch = xml.match(/<ValCurs[^>]*Date="(\d{2})\.(\d{2})\.(\d{4})"/i);
  if (!dateMatch) {
    throw new Error("Не удалось получить дату курсов из ответа ЦБ РФ");
  }

  const [, dd, mm, yyyy] = dateMatch;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
}

function parseRates(xml: string): ParsedRate[] {
  const valuteRegex = /<Valute[\s\S]*?<\/Valute>/g;
  const codeRegex = /<CharCode>\s*([A-Z]{3})\s*<\/CharCode>/i;
  const valueRegex = /<Value>\s*([\d,]+)\s*<\/Value>/i;
  const nominalRegex = /<Nominal>\s*(\d+)\s*<\/Nominal>/i;

  const rates: ParsedRate[] = [];
  for (const blockMatch of xml.matchAll(valuteRegex)) {
    const block = blockMatch[0];
    const code = block.match(codeRegex)?.[1];
    const valueRaw = block.match(valueRegex)?.[1];
    const nominalRaw = block.match(nominalRegex)?.[1];

    if (!code || !valueRaw || !nominalRaw) continue;

    const value = Number(valueRaw.replace(",", "."));
    const nominal = Number(nominalRaw);
    if (!Number.isFinite(value) || !Number.isFinite(nominal) || nominal <= 0 || value <= 0) {
      continue;
    }

    rates.push({ code, value, nominal });
  }

  return rates;
}

export async function updateExchangeRates(): Promise<number> {
  let response: Response;
  try {
    response = await fetch(CBR_DAILY_URL, { cache: "no-store" });
  } catch {
    throw new Error("Не удалось подключиться к API ЦБ РФ");
  }

  if (!response.ok) {
    throw new Error(`ЦБ РФ временно недоступен (HTTP ${response.status})`);
  }

  let xml = "";
  try {
    const arrayBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder("windows-1251");
    xml = decoder.decode(arrayBuffer);
  } catch {
    throw new Error("Не удалось декодировать ответ ЦБ РФ");
  }

  const date = parseXmlDate(xml);
  const rates = parseRates(xml);
  const filteredRates = rates.filter((r) => TARGET_CURRENCIES.has(r.code));

  if (filteredRates.length === 0) {
    throw new Error("ЦБ РФ вернул пустой список курсов");
  }

  let updatedCount = 0;

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

  for (const rate of filteredRates) {
    const rubPerOne = rate.value / rate.nominal;
    const inverse = 1 / rubPerOne;

    await saveRate(rate.code, "RUB", rubPerOne);
    await saveRate("RUB", rate.code, inverse);
  }

  return updatedCount;
}
