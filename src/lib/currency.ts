import { prisma } from "./prisma";

export type CurrencyCode = string;

/**
 * Двумерная карта курсов: { "USD": { "RUB": 90.5 }, ... }
 * Используется для конвертации без повторных запросов к БД внутри одного расчёта.
 */
export type ExchangeRateMap = Record<string, Record<string, number>>;

export const DEFAULT_BASE_CURRENCY = "RUB";

export interface CurrencyDirectoryItem {
  code: string;
  label: string;
  symbol: string;
}

function sourcePriority(source: string): number {
  if (source === "cbr" || source === "coingecko") return 2;
  if (source === "manual") return 1;
  return 0;
}

/**
 * Загружает последние курсы из БД и возвращает их в виде карты.
 * Для каждой пары (from, to) приоритет у источника ЦБ РФ (source="cbr"),
 * иначе берётся самая свежая запись любого источника.
 * Тождественный курс (X → X = 1) вычисляется на лету в convertAmount.
 */
export async function getExchangeRates(): Promise<ExchangeRateMap> {
  const rows = await prisma.exchangeRate.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const map: ExchangeRateMap = {};
  const chosenByPair = new Map<string, { source: string; date: Date; createdAt: Date }>();

  for (const row of rows) {
    if (!map[row.fromCurrency]) map[row.fromCurrency] = {};

    const pairKey = `${row.fromCurrency}-${row.toCurrency}`;
    const existing = chosenByPair.get(pairKey);

    if (!existing) {
      map[row.fromCurrency][row.toCurrency] = row.rate;
      chosenByPair.set(pairKey, {
        source: row.source,
        date: row.date,
        createdAt: row.createdAt,
      });
      continue;
    }

    const currentPriority = sourcePriority(row.source);
    const existingPriority = sourcePriority(existing.source);
    const isNewer =
      row.date.getTime() > existing.date.getTime() ||
      (row.date.getTime() === existing.date.getTime() &&
        row.createdAt.getTime() > existing.createdAt.getTime());

    if (currentPriority > existingPriority || (currentPriority === existingPriority && isNewer)) {
      map[row.fromCurrency][row.toCurrency] = row.rate;
      chosenByPair.set(pairKey, {
        source: row.source,
        date: row.date,
        createdAt: row.createdAt,
      });
    }
  }

  return map;
}

/**
 * Конвертирует сумму из fromCurrency в toCurrency.
 *
 * Порядок поиска курса:
 *   1. Прямой: map[from][to]
 *   2. Обратный: 1 / map[to][from]
 *   3. Через базовую валюту: map[from][RUB] / map[to][RUB]
 *   4. Fallback: возвращает исходную сумму с предупреждением
 *
 * Это покрывает все пары при наличии курсов X→RUB.
 * Подготовлено к расширению: достаточно добавить новые строки ExchangeRate.
 */
export function convertAmount(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rates: ExchangeRateMap
): number {
  if (fromCurrency === toCurrency) return amount;

  // 1. Прямой курс
  const direct = rates[fromCurrency]?.[toCurrency];
  if (direct !== undefined) return amount * direct;

  // 2. Обратный курс
  const inverse = rates[toCurrency]?.[fromCurrency];
  if (inverse !== undefined && inverse > 0) return amount / inverse;

  // 3. Кросс-курс через RUB: from→RUB и to→RUB
  const fromToRub = rates[fromCurrency]?.["RUB"];
  const toToRub = rates[toCurrency]?.["RUB"];
  if (fromToRub !== undefined && toToRub !== undefined && toToRub > 0) {
    return (amount * fromToRub) / toToRub;
  }

  // 4. Fallback
  console.warn(
    `[currency] Курс ${fromCurrency} → ${toCurrency} не найден, используется 1:1`
  );
  return amount;
}

/**
 * Возвращает базовую валюту из настроек приложения.
 * По умолчанию RUB, если настройка не задана.
 */
export async function getBaseCurrency(): Promise<string> {
  try {
    const setting = await prisma.appSettings.findUnique({
      where: { key: "baseCurrency" },
    });
    return setting?.value ?? DEFAULT_BASE_CURRENCY;
  } catch {
    return DEFAULT_BASE_CURRENCY;
  }
}

/**
 * Сохраняет базовую валюту в настройках приложения.
 */
export async function setBaseCurrency(currency: string): Promise<void> {
  await prisma.appSettings.upsert({
    where: { key: "baseCurrency" },
    update: { value: currency },
    create: { key: "baseCurrency", value: currency },
  });
}

export async function getActiveCurrencies(): Promise<CurrencyDirectoryItem[]> {
  const rows = await prisma.currency.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return rows.map((c) => ({ code: c.code, label: c.name, symbol: c.symbol }));
}
