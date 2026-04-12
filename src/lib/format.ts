// Форматирование валют и чисел для русского интерфейса

export function formatCurrency(
  amount: number,
  currency = "RUB",
  compact = false
): string {
  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === "RUB" ? 0 : 2,
    ...(compact && { notation: "compact", compactDisplay: "short" }),
  };

  return new Intl.NumberFormat("ru-RU", options).format(amount);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

const pluralRu = (n: number, one: string, few: string, many: string): string => {
  const k = Math.abs(n) % 100;
  const k1 = k % 10;
  if (k > 10 && k < 20) return many;
  if (k1 > 1 && k1 < 5) return few;
  if (k1 === 1) return one;
  return many;
};

/** Фраза для цели: сколько дней до дедлайна (days — как в GoalProgressItem.daysUntilTarget). */
export function formatGoalDeadlinePhrase(daysUntil: number | null): string {
  if (daysUntil === null) return "Без даты цели";
  if (daysUntil < 0) {
    const n = Math.abs(daysUntil);
    return `Просрочено на ${n} ${pluralRu(n, "день", "дня", "дней")}`;
  }
  if (daysUntil === 0) return "Дедлайн сегодня";
  return `Осталось ${daysUntil} ${pluralRu(daysUntil, "день", "дня", "дней")}`;
}

/**
 * Относительная формулировка до даты платежа (положительное — вперёди, отрицательное — просрочка).
 * Для горизонта от ~1.5 мес использует месяцы.
 */
export function formatRelativeDueFromDays(daysUntilDue: number): string {
  const rtf = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
  const useMonths = Math.abs(daysUntilDue) >= 45;
  if (useMonths) {
    const months = Math.round(daysUntilDue / 30.437);
    const m = months === 0 && daysUntilDue !== 0 ? (daysUntilDue > 0 ? 1 : -1) : months;
    return rtf.format(m, "month");
  }
  return rtf.format(daysUntilDue, "day");
}
