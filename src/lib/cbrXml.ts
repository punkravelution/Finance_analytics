/** Разбор ежедневного XML курсов ЦБ РФ (XML_daily.asp). */

export const CBR_DAILY_URL = "https://www.cbr.ru/scripts/XML_daily.asp";

export type CbrValute = {
  code: string;
  name: string;
  value: number;
  nominal: number;
};

export function parseXmlDate(xml: string): Date {
  const dateMatch = xml.match(/<ValCurs[^>]*Date="(\d{2})\.(\d{2})\.(\d{4})"/i);
  if (!dateMatch) {
    throw new Error("Не удалось получить дату курсов из ответа ЦБ РФ");
  }

  const [, dd, mm, yyyy] = dateMatch;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
}

export function parseValutes(xml: string): CbrValute[] {
  const valuteRegex = /<Valute[\s\S]*?<\/Valute>/g;
  const codeRegex = /<CharCode>\s*([A-Z]{3})\s*<\/CharCode>/i;
  const nameRegex = /<Name>\s*([^<]*?)\s*<\/Name>/i;
  const valueRegex = /<Value>\s*([\d,]+)\s*<\/Value>/i;
  const nominalRegex = /<Nominal>\s*(\d+)\s*<\/Nominal>/i;

  const rates: CbrValute[] = [];
  for (const blockMatch of xml.matchAll(valuteRegex)) {
    const block = blockMatch[0];
    const code = block.match(codeRegex)?.[1];
    const nameRaw = block.match(nameRegex)?.[1];
    const valueRaw = block.match(valueRegex)?.[1];
    const nominalRaw = block.match(nominalRegex)?.[1];

    if (!code || !valueRaw || !nominalRaw) continue;

    const value = Number(valueRaw.replace(",", "."));
    const nominal = Number(nominalRaw);
    if (!Number.isFinite(value) || !Number.isFinite(nominal) || nominal <= 0 || value <= 0) {
      continue;
    }

    const name = (nameRaw ?? "").trim() || code;
    rates.push({ code, name, value, nominal });
  }

  return rates;
}

export async function fetchCbrDailyXml(): Promise<string> {
  const response = await fetch(CBR_DAILY_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`ЦБ РФ временно недоступен (HTTP ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new TextDecoder("windows-1251").decode(arrayBuffer);
}
