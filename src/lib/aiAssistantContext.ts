import { prisma } from "@/lib/prisma";
import { getVaultSummaries } from "@/lib/analytics";
import { getBaseCurrency, getExchangeRates, convertAmount } from "@/lib/currency";
import { formatCurrency, formatDate } from "@/lib/format";
import { getTotalMonthlyIncome } from "@/app/actions/recurringIncome";
import { getGoalsProgress } from "@/app/actions/goal";
import { getUpcomingExpenses } from "@/app/actions/plannedExpense";

function monthlyFactor(period: string): number {
  if (period === "quarterly") return 1 / 3;
  if (period === "yearly") return 1 / 12;
  return 1;
}

async function getSubscriptionsMonthlyTotalInBase(): Promise<{
  total: number;
  currency: string;
}> {
  const [subs, baseCurrency, rates] = await Promise.all([
    prisma.subscription.findMany({
      where: { isActive: true },
      select: { amount: true, currency: true, billingPeriod: true },
    }),
    getBaseCurrency(),
    getExchangeRates(),
  ]);
  const total = subs.reduce(
    (sum, s) =>
      sum +
      convertAmount(s.amount * monthlyFactor(s.billingPeriod), s.currency, baseCurrency, rates),
    0
  );
  return { total, currency: baseCurrency };
}

async function getTopExpenseCategoriesLast30Days(
  limit: number
): Promise<Array<{ name: string; totalInBase: number }>> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [baseCurrency, rates, rows] = await Promise.all([
    getBaseCurrency(),
    getExchangeRates(),
    prisma.transaction.findMany({
      where: { type: "expense", date: { gte: since } },
      select: {
        amount: true,
        currency: true,
        category: { select: { name: true } },
      },
    }),
  ]);
  const map = new Map<string, number>();
  for (const r of rows) {
    const name = r.category?.name ?? "Без категории";
    const inBase = convertAmount(r.amount, r.currency, baseCurrency, rates);
    map.set(name, (map.get(name) ?? 0) + inBase);
  }
  return [...map.entries()]
    .map(([name, totalInBase]) => ({ name, totalInBase }))
    .sort((a, b) => b.totalInBase - a.totalInBase)
    .slice(0, limit);
}

/** Текстовый снимок для подстановки в system prompt (русский). */
export async function buildFinancialContextForAi(): Promise<string> {
  const [
    vaultSummaries,
    recurringIncome,
    subscriptionsMonthly,
    goalsProgress,
    upcoming,
    topCategories,
  ] = await Promise.all([
    getVaultSummaries(),
    getTotalMonthlyIncome(),
    getSubscriptionsMonthlyTotalInBase(),
    getGoalsProgress(),
    getUpcomingExpenses(),
    getTopExpenseCategoriesLast30Days(5),
  ]);

  const baseCurrency = recurringIncome.currency;
  const totalVaultCapital = vaultSummaries.reduce((s, v) => s + v.balanceInBaseCurrency, 0);

  const lines: string[] = [];
  lines.push(
    `Базовая валюта приложения: ${baseCurrency}. Все суммы ниже приведены к ней, если не указано иное.`
  );
  lines.push(
    `Суммарный капитал по активным хранилищам (сумма балансов): ${formatCurrency(totalVaultCapital, baseCurrency)}.`
  );
  lines.push(
    `Регулярные доходы (активные повторяющиеся доходы) в месяц: ${formatCurrency(recurringIncome.totalMonthly, baseCurrency)}.`
  );
  lines.push(
    `Подписки (активные) в пересчёте на месяц: ${formatCurrency(subscriptionsMonthly.total, baseCurrency)}.`
  );

  const activeGoals = goalsProgress.filter((g) => !g.isCompleted);
  if (activeGoals.length === 0) {
    lines.push("Активные цели: нет незавершённых целей.");
  } else {
    lines.push("Активные цели и прогресс:");
    for (const g of activeGoals) {
      const targetLine = `${formatCurrency(g.currentAmount, g.currency)} / ${formatCurrency(g.targetAmount, g.currency)} (${g.percentComplete.toFixed(1)}%)`;
      const datePart =
        g.targetDate != null ? `, дедлайн ${formatDate(g.targetDate)}` : "";
      const monthly =
        g.monthlyRequired != null
          ? `, оценка нужного темпа: ${formatCurrency(g.monthlyRequired, g.currency)}/мес`
          : "";
      lines.push(`  — «${g.name}»: ${targetLine}${datePart}${monthly}`);
    }
  }

  const nearestPlanned = upcoming.slice(0, 10);
  if (nearestPlanned.length === 0) {
    lines.push("Ближайшие запланированные платежи: незапланированных неоплаченных нет.");
  } else {
    lines.push("Ближайшие запланированные платежи (неоплаченные, по дате):");
    for (const p of nearestPlanned) {
      lines.push(
        `  — «${p.name}»: ${formatCurrency(p.amount, p.currency)}, срок ${formatDate(p.dueDate)} (через ${p.daysUntilDue} дн.)`
      );
    }
  }

  if (topCategories.length === 0) {
    lines.push("Топ категорий расходов за последние 30 дней: нет расходных операций с категориями.");
  } else {
    lines.push("Топ-5 категорий расходов за последние 30 дней (по транзакциям):");
    topCategories.forEach((c, i) => {
      lines.push(`  ${i + 1}. ${c.name}: ${formatCurrency(c.totalInBase, baseCurrency)}`);
    });
  }

  return lines.join("\n");
}
