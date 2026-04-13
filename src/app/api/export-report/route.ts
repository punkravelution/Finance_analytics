import { prisma } from "@/lib/prisma";
import { convertAmount, getBaseCurrency, getExchangeRates } from "@/lib/currency";
import { getVaultBalance } from "@/lib/vaultBalance";
import { NextRequest } from "next/server";
import { getCategoryBudgetMap } from "@/lib/categoryBudgets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TxType = "income" | "expense" | "transfer";

function formatMoney(value: number, currency = "RUB"): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === "RUB" ? 0 : 2,
  }).format(value);
}

function formatDateLongRu(date: Date): string {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return formatted.replace(" г.", "");
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatDateFull(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toMonthlyFactor(period: string): number {
  if (period === "weekly") return 52 / 12;
  if (period === "biweekly") return 26 / 12;
  if (period === "quarterly") return 1 / 3;
  if (period === "yearly") return 1 / 12;
  return 1;
}

function monthHeader(date: Date): string {
  const raw = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  })
    .format(date)
    .replace(" г.", "");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function periodLabel(period: string): string {
  if (period === "weekly") return "еженедельно";
  if (period === "biweekly") return "раз в 2 недели";
  if (period === "quarterly") return "ежеквартально";
  if (period === "yearly") return "ежегодно";
  return "ежемесячно";
}

function txTypeLabel(type: TxType): string {
  if (type === "income") return "доход";
  if (type === "expense") return "расход";
  return "перевод";
}

function txSignedAmount(type: TxType, amount: number, currency: string): string {
  const abs = Math.abs(amount);
  if (type === "income") return `+${formatMoney(abs, currency)}`;
  if (type === "expense") return `-${formatMoney(abs, currency)}`;
  return `→ ${formatMoney(abs, currency)}`;
}

function cleanDescription(raw: string): string {
  return raw
    .replace(/^Операция\s*\(/i, "")
    .replace(/\)\s*$/, "")
    .replace(/\.\s*Операция по карте\s*\*+\d{4}/gi, "")
    .replace(/Дата обработки[¹1]\s*и код авторизации операции[²2]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function daysUntil(dueDate: Date, today: Date): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const end = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
  return Math.ceil((end - start) / 86400000);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

type ExportMode = "briefing" | "expenses" | "debts" | "goals";

async function getCategoryBudgetDeviations(
  now: Date,
  baseCurrency: string,
  rates: Awaited<ReturnType<typeof getExchangeRates>>
): Promise<Array<{ category: string; limit: number; spent: number; diff: number }>> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [budgetMap, expenseRows] = await Promise.all([
    getCategoryBudgetMap(),
    prisma.transaction.findMany({
      where: {
        type: "expense",
        date: { gte: monthStart, lte: now },
        categoryId: { not: null },
      },
      select: {
        categoryId: true,
        amount: true,
        currency: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const spentMap = new Map<string, { category: string; spent: number }>();
  for (const tx of expenseRows) {
    if (!tx.categoryId) continue;
    const baseAmount = convertAmount(tx.amount, tx.currency, baseCurrency, rates);
    const prev = spentMap.get(tx.categoryId) ?? {
      category: tx.category?.name ?? "Без категории",
      spent: 0,
    };
    prev.spent += baseAmount;
    spentMap.set(tx.categoryId, prev);
  }

  return Object.entries(budgetMap)
    .map(([categoryId, limit]) => {
      const spent = spentMap.get(categoryId);
      if (!spent) return null;
      const diff = spent.spent - limit;
      return { category: spent.category, limit, spent: spent.spent, diff };
    })
    .filter((row): row is { category: string; limit: number; spent: number; diff: number } => row != null)
    .sort((a, b) => b.diff - a.diff);
}

async function buildBriefing(now: Date): Promise<string> {
  const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getExchangeRates()]);
  const base = baseCurrency;
  const periodStart = new Date(now);
  periodStart.setMonth(periodStart.getMonth() - 3);
  const since90 = new Date(now);
  since90.setDate(since90.getDate() - 90);
  const since30 = new Date(now);
  since30.setDate(since30.getDate() - 30);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    vaults,
    recurringIncomes,
    subscriptions,
    liabilities,
    goals,
    plannedExpenses,
    expense30,
    tx90Rows,
    tx3ExpenseRows,
    budgetDeviations,
  ] = await Promise.all([
    prisma.vault.findMany({
      where: { isActive: true },
      include: { assets: { where: { isActive: true }, select: { currentTotalValue: true, currency: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.recurringIncome.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.subscription.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.liability.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.goal.findMany({ where: { isCompleted: false }, orderBy: { createdAt: "asc" } }),
    prisma.plannedExpense.findMany({
      where: { isPaid: false, dueDate: { gt: now } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.transaction.findMany({
      where: { type: "expense", date: { gte: since30 } },
      select: { amount: true, currency: true, category: { select: { name: true } } },
    }),
    prisma.transaction.findMany({
      where: { type: { in: ["income", "expense"] }, date: { gte: since90 } },
      select: { amount: true, currency: true, type: true },
    }),
    prisma.transaction.findMany({
      where: { type: "expense", date: { gte: periodStart } },
      select: { amount: true, currency: true, date: true, category: { select: { name: true } } },
    }),
    getCategoryBudgetDeviations(now, base, rates),
  ]);

  const vaultRows = vaults.map((vault) => {
    const native = getVaultBalance(vault, rates);
    const inBase = convertAmount(native.balance, native.currency, base, rates);
    return {
      id: vault.id,
      name: vault.name,
      liquidityLevel: vault.liquidityLevel,
      balanceInBase: inBase,
    };
  });
  const capital = vaultRows.reduce((sum, v) => sum + v.balanceInBase, 0);
  const liquidHigh = vaultRows
    .filter((v) => v.liquidityLevel === "high")
    .reduce((sum, v) => sum + v.balanceInBase, 0);

  const monthlyIncome = recurringIncomes.reduce(
    (sum, r) => sum + convertAmount(r.amount * toMonthlyFactor(r.billingPeriod), r.currency, base, rates),
    0
  );
  const monthlySubscriptions = subscriptions.reduce(
    (sum, s) => sum + convertAmount(s.amount * toMonthlyFactor(s.billingPeriod), s.currency, base, rates),
    0
  );
  const liabilitiesRows = liabilities.map((l) => {
    const balanceBase = convertAmount(l.currentBalance, l.currency, base, rates);
    const minPaymentBase = convertAmount(l.minimumPayment ?? 0, l.currency, base, rates);
    return { ...l, balanceBase, minPaymentBase };
  });
  const totalDebt = liabilitiesRows.reduce((sum, l) => sum + l.balanceBase, 0);
  const monthlyMinPayments = liabilitiesRows.reduce((sum, l) => sum + l.minPaymentBase, 0);
  const net = capital - totalDebt;
  const monthlyExpense = tx90Rows
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + convertAmount(t.amount, t.currency, base, rates), 0) / 3;
  const fcf = monthlyIncome - monthlySubscriptions - monthlyMinPayments;

  const flags: string[] = [];
  const criticalMetrics: string[] = [];

  const needsKeywords = ["продукты", "жкх", "транспорт", "здоровье", "связь", "кредит", "рассрочка"];
  const wantsKeywords = ["кафе", "рестораны", "развлечения", "подписки", "одежда", "доставка", "такси"];
  let needsBase = 0;
  let wantsBase = 0;
  for (const row of expense30) {
    const categoryName = (row.category?.name ?? "").toLocaleLowerCase("ru-RU");
    const valueBase = convertAmount(row.amount, row.currency, base, rates);
    const isWants = wantsKeywords.some((k) => categoryName.includes(k));
    const isNeeds = needsKeywords.some((k) => categoryName.includes(k));
    if (isWants) wantsBase += valueBase;
    else if (isNeeds) needsBase += valueBase;
    else needsBase += valueBase;
  }
  const needsPct = monthlyIncome > 0 ? (needsBase / monthlyIncome) * 100 : 0;
  const wantsPct = monthlyIncome > 0 ? (wantsBase / monthlyIncome) * 100 : 0;
  const savingsPct = monthlyIncome > 0 ? ((monthlyIncome - needsBase - wantsBase) / monthlyIncome) * 100 : 0;
  const savingsStatus =
    savingsPct >= 20 ? "норма" : savingsPct >= 10 ? "ниже нормы" : "критично ниже нормы";

  const cushionMonths = monthlyExpense > 0 ? liquidHigh / monthlyExpense : 0;
  const cushionStatus =
    cushionMonths < 1 ? "критично" : cushionMonths < 3 ? "недостаточно" : "норма";
  if (cushionMonths < 1) flags.push("🚨 КРИТИЧНО: подушка менее 1 месяца");
  else if (cushionMonths < 3) flags.push(`⚠️ Подушка недостаточна: ${cushionMonths.toFixed(1)} мес из 3 необходимых`);

  const debtLoadPct = monthlyIncome > 0 ? (monthlyMinPayments / monthlyIncome) * 100 : 0;
  const debtStatus = debtLoadPct > 40 ? "критично" : debtLoadPct > 30 ? "повышена" : "норма";
  if (debtLoadPct > 40) flags.push(`🚨 КРИТИЧНО: долговая нагрузка ${formatPct(debtLoadPct)}`);
  else if (debtLoadPct > 30) flags.push(`⚠️ Долговая нагрузка повышена: ${formatPct(debtLoadPct)}`);
  if (fcf < 0) flags.push("🚨 FCF отрицательный: расходы превышают доход");
  budgetDeviations
    .filter((b) => b.diff > 0)
    .slice(0, 3)
    .forEach((b) => {
      flags.push(
        `⚠️ [Бюджет] ${b.category}: перерасход ${formatMoney(b.diff, base)} (лимит ${formatMoney(b.limit, base)})`
      );
    });

  const categoryStats = new Map<string, { prev: number; curr: number; total3m: number }>();
  for (const tx of tx3ExpenseRows) {
    const category = tx.category?.name ?? "Без категории";
    const curr = categoryStats.get(category) ?? { prev: 0, curr: 0, total3m: 0 };
    const valueBase = convertAmount(tx.amount, tx.currency, base, rates);
    curr.total3m += valueBase;
    if (tx.date >= currentMonthStart && tx.date <= now) curr.curr += valueBase;
    else if (tx.date >= previousMonthStart && tx.date < previousMonthEnd) curr.prev += valueBase;
    categoryStats.set(category, curr);
  }

  const anomalyRows = [...categoryStats.entries()]
    .map(([category, values]) => {
      const growthPct = values.prev > 0 ? ((values.curr - values.prev) / values.prev) * 100 : 0;
      return { category, ...values, growthPct };
    })
    .filter((x) => x.prev > 0 && x.growthPct > 30)
    .sort((a, b) => b.growthPct - a.growthPct)
    .slice(0, 3);
  anomalyRows.forEach((a) => {
    flags.push(
      `⚠️ [${a.category}]: рост на ${formatPct(a.growthPct)} (было ${formatMoney(a.prev, base)}, стало ${formatMoney(a.curr, base)})`
    );
  });

  const overdueGoals = goals.filter((g) => g.targetDate != null && g.targetDate < now);
  overdueGoals.forEach((g) => {
    flags.push(`⚠️ Просрочена цель '${g.name}'`);
  });

  const planned30 = plannedExpenses.filter((p) => p.dueDate && daysUntil(p.dueDate, now) <= 30);
  const liabilities14 = liabilitiesRows.filter((l) => l.nextPaymentDate && daysUntil(l.nextPaymentDate, now) <= 14);
  const obligationsSoonBase =
    planned30.reduce((sum, p) => sum + convertAmount(p.amount, p.currency, base, rates), 0) +
    liabilities14.reduce((sum, l) => sum + l.minPaymentBase, 0);
  const availableBalanceBase = vaultRows.reduce((sum, v) => sum + v.balanceInBase, 0);
  if (obligationsSoonBase > 0 && availableBalanceBase < obligationsSoonBase) {
    flags.push(`🚨 КАССОВЫЙ РАЗРЫВ: обязательства ${formatMoney(obligationsSoonBase, base)}, доступно ${formatMoney(availableBalanceBase, base)}`);
  }

  criticalMetrics.push(`- Подушка безопасности: ${cushionMonths.toFixed(1)} мес (${cushionStatus})`);
  criticalMetrics.push(`- Долговая нагрузка: ${formatPct(debtLoadPct)} от дохода (${debtStatus})`);
  criticalMetrics.push(`- Норма сбережений: ${formatPct(savingsPct)} (статус: ${savingsStatus}, норма 20%)`);
  criticalMetrics.push(`- 50/30/20: Нужды ${formatPct(needsPct)} | Желания ${formatPct(wantsPct)} | Накопления ${formatPct(savingsPct)}`);

  let weightedRateNum = 0;
  let weightedRateDen = 0;
  for (const l of liabilitiesRows) {
    if (l.interestRate != null && l.balanceBase > 0) {
      weightedRateNum += l.interestRate * l.balanceBase;
      weightedRateDen += l.balanceBase;
    }
  }
  const weightedRate = weightedRateDen > 0 ? weightedRateNum / weightedRateDen : 0;

  const categoryTop8 = [...categoryStats.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total3m - a.total3m)
    .slice(0, 8);

  const goalForecastLines = goals.map((g) => {
    const remainingBase = convertAmount(Math.max(0, g.targetAmount - g.currentAmount), g.currency, base, rates);
    const progress = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
    if (fcf <= 0) {
      return `- ${g.name}: ${progress.toFixed(1)}% | нужно ${formatMoney(remainingBase, base)} | ⚠️ FCF недостаточен`;
    }
    const months = remainingBase / fcf;
    return `- ${g.name}: ${progress.toFixed(1)}% | нужно ${formatMoney(remainingBase, base)} | достигнешь через ${Math.ceil(months)} мес при текущем FCF`;
  });

  const highRateDebt = liabilitiesRows
    .filter((l) => l.interestRate != null && l.interestRate > 10)
    .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0];

  const questions: string[] = [
    `1. Как оптимально распределить ${formatMoney(Math.max(0, fcf), base)}/мес с учётом долгов и целей?`,
    "2. Какие расходы сократить чтобы достичь нормы сбережений 20%?",
  ];
  if (highRateDebt) {
    questions.push("3. Стратегия погашения долгов методом лавины");
  }
  if (cushionMonths < 3) {
    const idx = questions.length + 1;
    questions.push(`${idx}. Как нарастить подушку безопасности до 3 месяцев?`);
  }

  const markdown = `# ФИНАНСОВЫЙ БРИФИНГ
Дата: ${formatDateLongRu(now)}
Подготовлен для анализа с AI-ассистентом

---

## ФИНАНСОВОЕ ПОЛОЖЕНИЕ
Капитал: ${formatMoney(capital, base)} | Долги: ${formatMoney(totalDebt, base)} | Чистый: ${formatMoney(net, base)}
Доход/мес: ${formatMoney(monthlyIncome, base)} | Расход/мес: ${formatMoney(monthlyExpense, base)} | Свободный поток: ${formatMoney(fcf, base)}

---

## КРИТИЧЕСКИЕ МЕТРИКИ
${criticalMetrics.join("\n")}

---

## АНОМАЛИИ И ФЛАГИ
${flags.length > 0 ? flags.join("\n") : "Критических отклонений не обнаружено"}

---

## РАСХОДЫ ПО КАТЕГОРИЯМ (топ-8 за последние 3 месяца)
| Категория | Пред. месяц | Тек. месяц | Изменение |
|-----------|-------------|------------|-----------|
${categoryTop8
  .map((c) => {
    const change = c.prev > 0 ? ((c.curr - c.prev) / c.prev) * 100 : 0;
    return `| ${c.category} | ${formatMoney(c.prev, base)} | ${formatMoney(c.curr, base)} | ${formatPct(change)} |`;
  })
  .join("\n")}

---

## ОБЯЗАТЕЛЬСТВА
${liabilitiesRows
  .map((l) => {
    const rate = l.interestRate == null ? "—" : `${l.interestRate}%`;
    const minPay = l.minimumPayment == null ? "—" : formatMoney(l.minimumPayment, l.currency);
    const nextDate = l.nextPaymentDate ? formatDateFull(l.nextPaymentDate) : "—";
    return `- ${l.name}: остаток ${formatMoney(l.currentBalance, l.currency)}, ставка ${rate}, мин. платёж ${minPay}, следующая дата ${nextDate}`;
  })
  .join("\n")}
Итого долгов: ${formatMoney(totalDebt, base)} | Средневзвешенная ставка: ${weightedRate.toFixed(2)}%

---

## ЦЕЛИ И ПРОГНОЗ
${goalForecastLines.join("\n")}

---

## ЗАПЛАНИРОВАННЫЕ ПЛАТЕЖИ
${plannedExpenses
  .map((p) => `- ${p.name}: ${formatMoney(p.amount, p.currency)} · ${p.dueDate ? formatDateFull(p.dueDate) : "без даты"}`)
  .join("\n")}

---

## РЕКОМЕНДУЕМЫЕ ВОПРОСЫ ДЛЯ AI-АНАЛИТИКА
${questions.join("\n")}

---
*Финансовый брифинг сгенерирован ${formatDateLongRu(now)}. Для детального анализа транзакций используйте полный экспорт.*
---`;

  return markdown;
}

async function buildExpensesAnalysis(now: Date): Promise<string> {
  const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getExchangeRates()]);
  const base = baseCurrency;
  const since90 = new Date(now);
  since90.setDate(since90.getDate() - 90);
  const since30 = new Date(now);
  since30.setDate(since30.getDate() - 30);

  const [tx90, recurringIncomes, subscriptions, liabilities] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: { in: ["income", "expense"] }, date: { gte: since90 } },
      select: {
        date: true,
        amount: true,
        currency: true,
        type: true,
        category: { select: { name: true } },
      },
    }),
    prisma.recurringIncome.findMany({ where: { isActive: true }, select: { amount: true, currency: true, billingPeriod: true } }),
    prisma.subscription.findMany({ where: { isActive: true }, select: { amount: true, currency: true, billingPeriod: true } }),
    prisma.liability.findMany({ where: { isActive: true }, select: { minimumPayment: true, currency: true } }),
  ]);

  const monthlyIncome = recurringIncomes.reduce(
    (sum, r) => sum + convertAmount(r.amount * toMonthlyFactor(r.billingPeriod), r.currency, base, rates),
    0
  );
  const monthlySubscriptions = subscriptions.reduce(
    (sum, s) => sum + convertAmount(s.amount * toMonthlyFactor(s.billingPeriod), s.currency, base, rates),
    0
  );
  const monthlyMinPayments = liabilities.reduce(
    (sum, l) => sum + convertAmount(l.minimumPayment ?? 0, l.currency, base, rates),
    0
  );
  const fcf = monthlyIncome - monthlySubscriptions - monthlyMinPayments;

  const expense30 = tx90.filter((t) => t.type === "expense" && t.date >= since30);
  const needsKeywords = ["продукты", "жкх", "транспорт", "здоровье", "связь", "кредит", "рассрочка"];
  const wantsKeywords = ["кафе", "рестораны", "развлечения", "подписки", "одежда", "доставка", "такси"];
  let needsBase = 0;
  let wantsBase = 0;
  for (const row of expense30) {
    const categoryName = (row.category?.name ?? "").toLocaleLowerCase("ru-RU");
    const valueBase = convertAmount(row.amount, row.currency, base, rates);
    const isWants = wantsKeywords.some((k) => categoryName.includes(k));
    const isNeeds = needsKeywords.some((k) => categoryName.includes(k));
    if (isWants) wantsBase += valueBase;
    else if (isNeeds) needsBase += valueBase;
    else needsBase += valueBase;
  }
  const needsPct = monthlyIncome > 0 ? (needsBase / monthlyIncome) * 100 : 0;
  const wantsPct = monthlyIncome > 0 ? (wantsBase / monthlyIncome) * 100 : 0;
  const savingsPct = monthlyIncome > 0 ? ((monthlyIncome - needsBase - wantsBase) / monthlyIncome) * 100 : 0;

  const monthKeys = [
    new Date(now.getFullYear(), now.getMonth() - 2, 1),
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    new Date(now.getFullYear(), now.getMonth(), 1),
  ];
  const monthLabels = monthKeys.map((d) =>
    new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(d).replace(".", "")
  );
  const stats = new Map<string, { m0: number; m1: number; m2: number; total: number }>();
  for (const tx of tx90) {
    if (tx.type !== "expense") continue;
    const cat = tx.category?.name ?? "Без категории";
    const row = stats.get(cat) ?? { m0: 0, m1: 0, m2: 0, total: 0 };
    const v = convertAmount(tx.amount, tx.currency, base, rates);
    if (tx.date >= monthKeys[2]) row.m2 += v;
    else if (tx.date >= monthKeys[1]) row.m1 += v;
    else row.m0 += v;
    row.total += v;
    stats.set(cat, row);
  }
  const sortedRows = [...stats.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total);
  const anomalies = sortedRows
    .map((r) => ({ ...r, growthPct: r.m1 > 0 ? ((r.m2 - r.m1) / r.m1) * 100 : 0 }))
    .filter((r) => r.growthPct > 20)
    .slice(0, 8);

  return `# АНАЛИЗ РАСХОДОВ — ${formatDateLongRu(now)}

## ВОПРОС ДЛЯ AI-АНАЛИТИКА
Проанализируй мои расходы. Найди категории где можно сократить траты.
Рассчитай: если сократить топ-3 проблемных категории на 30% —
сколько высвободится в месяц и как это повлияет на достижение моих целей?

## ДОХОД И СВОБОДНЫЙ ПОТОК
Доход/мес: ${formatMoney(monthlyIncome, base)} | FCF: ${formatMoney(fcf, base)} | Норма сбережений: ${formatPct(savingsPct)}

## РАСХОДЫ ПО КАТЕГОРИЯМ (последние 3 месяца)
| Категория | ${monthLabels[0]} | ${monthLabels[1]} | ${monthLabels[2]} | Итого | % от дохода | Тренд |
|-----------|-----:|-----:|-----:|------:|-----------:|------:|
${sortedRows
  .map((r) => {
    const pctIncome = monthlyIncome > 0 ? (r.total / monthlyIncome) * 100 : 0;
    const trend = r.m1 > 0 ? ((r.m2 - r.m1) / r.m1) * 100 : 0;
    return `| ${r.category} | ${formatMoney(r.m0, base)} | ${formatMoney(r.m1, base)} | ${formatMoney(r.m2, base)} | ${formatMoney(r.total, base)} | ${formatPct(pctIncome)} | ${formatPct(trend)} |`;
  })
  .join("\n")}

## АНОМАЛИИ
${anomalies.length > 0
  ? anomalies
      .map((a) => `- ⚠️ ${a.category}: рост ${formatPct(a.growthPct)} (было ${formatMoney(a.m1, base)}, стало ${formatMoney(a.m2, base)})`)
      .join("\n")
  : "Аномалий роста >20% не обнаружено"}

## ПРАВИЛО 50/30/20
Факт: Нужды ${formatPct(needsPct)} | Желания ${formatPct(wantsPct)} | Накопления ${formatPct(savingsPct)}
Норма: Нужды 50% | Желания 30% | Накопления 20%
`;
}

async function buildDebtsStrategy(now: Date): Promise<string> {
  const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getExchangeRates()]);
  const base = baseCurrency;
  const [recurringIncomes, subscriptions, liabilities, goals, plannedExpenses] = await Promise.all([
    prisma.recurringIncome.findMany({ where: { isActive: true }, select: { amount: true, currency: true, billingPeriod: true } }),
    prisma.subscription.findMany({ where: { isActive: true }, select: { amount: true, currency: true, billingPeriod: true, name: true } }),
    prisma.liability.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.goal.findMany({ where: { isCompleted: false }, orderBy: { createdAt: "asc" } }),
    prisma.plannedExpense.findMany({
      where: { isPaid: false, dueDate: { gt: now } },
      orderBy: { dueDate: "asc" },
      take: 15,
    }),
  ]);

  const monthlyIncome = recurringIncomes.reduce(
    (sum, r) => sum + convertAmount(r.amount * toMonthlyFactor(r.billingPeriod), r.currency, base, rates),
    0
  );
  const monthlySubscriptions = subscriptions.reduce(
    (sum, s) => sum + convertAmount(s.amount * toMonthlyFactor(s.billingPeriod), s.currency, base, rates),
    0
  );
  const liabilitiesRows = liabilities.map((l) => {
    const balanceBase = convertAmount(l.currentBalance, l.currency, base, rates);
    const minPaymentBase = convertAmount(l.minimumPayment ?? 0, l.currency, base, rates);
    const monthsToPayoff =
      l.minimumPayment != null && l.minimumPayment > 0 ? l.currentBalance / l.minimumPayment : null;
    return { ...l, balanceBase, minPaymentBase, monthsToPayoff };
  });
  const totalDebt = liabilitiesRows.reduce((sum, l) => sum + l.balanceBase, 0);
  const monthlyMinPayments = liabilitiesRows.reduce((sum, l) => sum + l.minPaymentBase, 0);
  const fcf = monthlyIncome - monthlySubscriptions - monthlyMinPayments;
  const debtLoadPct = monthlyIncome > 0 ? (monthlyMinPayments / monthlyIncome) * 100 : 0;
  let weightedRateNum = 0;
  let weightedRateDen = 0;
  for (const l of liabilitiesRows) {
    if (l.interestRate != null && l.balanceBase > 0) {
      weightedRateNum += l.interestRate * l.balanceBase;
      weightedRateDen += l.balanceBase;
    }
  }
  const weightedRate = weightedRateDen > 0 ? weightedRateNum / weightedRateDen : 0;

  return `# СТРАТЕГИЯ ПОГАШЕНИЯ ДОЛГОВ — ${formatDateLongRu(now)}

## ВОПРОС ДЛЯ AI-АНАЛИТИКА
Разработай оптимальную стратегию погашения моих долгов методом лавины.
Рассчитай: при каком распределении свободного потока (FCF) я погашу все долги
быстрее всего и с минимальной переплатой? Учти мои цели и запланированные платежи.

## СВОБОДНЫЙ ПОТОК
FCF: ${formatMoney(fcf, base)}/мес (после обязательных платежей)

## ВСЕ ДОЛГИ
${liabilitiesRows
  .map((l) => {
    const rate = l.interestRate == null ? "—" : `${l.interestRate}%`;
    const minPay = l.minimumPayment == null ? "—" : formatMoney(l.minimumPayment, l.currency);
    const nextDate = l.nextPaymentDate ? formatDateFull(l.nextPaymentDate) : "—";
    const months = l.monthsToPayoff == null ? "—" : `${Math.ceil(l.monthsToPayoff)} мес`;
    return `- ${l.name}: остаток ${formatMoney(l.currentBalance, l.currency)}, ставка ${rate}, мин. платёж ${minPay}, следующая дата ${nextDate}, месяцев до погашения при мин. платеже: ${months}`;
  })
  .join("\n")}
Итого: ${formatMoney(totalDebt, base)} | Средняя ставка: ${weightedRate.toFixed(2)}% | Долговая нагрузка: ${formatPct(debtLoadPct)} от дохода

## ЦЕЛИ КОТОРЫЕ КОНКУРИРУЮТ С ДОЛГАМИ
${goals
  .map((g) => {
    const needMonthly = g.targetDate
      ? Math.max(
          0,
          (g.targetAmount - g.currentAmount) /
            Math.max(1 / 30, (g.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.437))
        )
      : null;
    const due = g.targetDate ? formatDateFull(g.targetDate) : "без даты";
    return `- ${g.name}: дедлайн ${due}, нужно в месяц ${needMonthly != null ? formatMoney(needMonthly, g.currency) : "—"}`;
  })
  .join("\n")}

## ЗАПЛАНИРОВАННЫЕ ОБЯЗАТЕЛЬНЫЕ ПЛАТЕЖИ
${plannedExpenses
  .map((p) => `- ${p.name}: ${formatMoney(p.amount, p.currency)} · ${p.dueDate ? formatDateFull(p.dueDate) : "без даты"}`)
  .join("\n")}
`;
}

async function buildGoalsForecast(now: Date): Promise<string> {
  const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getExchangeRates()]);
  const base = baseCurrency;
  const [recurringIncomes, subscriptions, liabilities, goals] = await Promise.all([
    prisma.recurringIncome.findMany({ where: { isActive: true }, select: { amount: true, currency: true, billingPeriod: true } }),
    prisma.subscription.findMany({ where: { isActive: true }, select: { amount: true, currency: true, billingPeriod: true, name: true } }),
    prisma.liability.findMany({ where: { isActive: true }, select: { minimumPayment: true, currency: true, name: true, currentBalance: true } }),
    prisma.goal.findMany({ where: { isCompleted: false }, orderBy: { createdAt: "asc" } }),
  ]);

  const monthlyIncome = recurringIncomes.reduce(
    (sum, r) => sum + convertAmount(r.amount * toMonthlyFactor(r.billingPeriod), r.currency, base, rates),
    0
  );
  const monthlySubscriptions = subscriptions.reduce(
    (sum, s) => sum + convertAmount(s.amount * toMonthlyFactor(s.billingPeriod), s.currency, base, rates),
    0
  );
  const monthlyMinPayments = liabilities.reduce(
    (sum, l) => sum + convertAmount(l.minimumPayment ?? 0, l.currency, base, rates),
    0
  );
  const fcf = monthlyIncome - monthlySubscriptions - monthlyMinPayments;
  const fcfAfterDebts = monthlyIncome - monthlyMinPayments;

  const goalRows = goals.map((g) => {
    const remaining = Math.max(0, g.targetAmount - g.currentAmount);
    const progress = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
    const daysLeft = g.targetDate ? Math.max(0, daysUntil(g.targetDate, now)) : null;
    let needMonthly = 0;
    if (g.targetDate) {
      const months = Math.max(1 / 30, (g.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.437));
      needMonthly = remaining / months;
    }
    const needMonthlyBase = convertAmount(needMonthly, g.currency, base, rates);
    const remainingBase = convertAmount(remaining, g.currency, base, rates);
    const status = fcf <= 0 ? "🚨 нереалистично при текущем FCF" : needMonthlyBase <= fcf ? "✅ реалистично" : needMonthlyBase <= fcf * 1.5 ? "⚠️ под угрозой" : "🚨 нереалистично при текущем FCF";
    return { g, progress, daysLeft, needMonthly, needMonthlyBase, remainingBase, status };
  });
  const totalNeedBase = goalRows.reduce((sum, r) => sum + r.needMonthlyBase, 0);
  const coverPct = totalNeedBase > 0 ? (Math.max(0, fcf) / totalNeedBase) * 100 : 0;

  return `# ПРОГНОЗ ПО ЦЕЛЯМ — ${formatDateLongRu(now)}

## ВОПРОС ДЛЯ AI-АНАЛИТИКА
Оцени реалистичность моих финансовых целей.
Рассчитай оптимальное распределение свободного потока между целями с учётом их приоритетов и дедлайнов.
Предложи: какие цели достижимы, какие нужно скорректировать, как ускорить достижение приоритетных.

## СВОБОДНЫЙ ПОТОК
FCF: ${formatMoney(fcf, base)}/мес | После мин. платежей по долгам: ${formatMoney(fcfAfterDebts, base)}/мес

## ЦЕЛИ
${goalRows
  .map((r) => {
    const deadline = r.g.targetDate ? formatDateFull(r.g.targetDate) : "без даты";
    const days = r.daysLeft == null ? "—" : `${r.daysLeft}`;
    return `- ${r.g.name}: нужно ${formatMoney(r.g.targetAmount, r.g.currency)}, накоплено ${formatMoney(r.g.currentAmount, r.g.currency)}, ${formatPct(r.progress)}, нужно в месяц ${formatMoney(r.needMonthly, r.g.currency)}, дедлайн ${deadline}, дней осталось ${days} | ${r.status}`;
  })
  .join("\n")}
Итого нужно на все цели: ${formatMoney(totalNeedBase, base)}/мес | FCF покрывает: ${formatPct(coverPct)} потребности

## ОБЯЗАТЕЛЬСТВА КОТОРЫЕ МЕШАЮТ ЦЕЛЯМ
${[
  ...liabilities.map((l) => `- Долг ${l.name}: мин. платёж ${formatMoney(l.minimumPayment ?? 0, l.currency)}`),
  ...subscriptions.map((s) => `- Подписка ${s.name}: ${formatMoney(s.amount, s.currency)} (${s.billingPeriod})`),
].join("\n")}
`;
}

export async function GET(request: NextRequest): Promise<Response> {
  const now = new Date();
  const mode = request.nextUrl.searchParams.get("mode") as ExportMode | null;
  if (mode === "briefing") {
    const markdown = await buildBriefing(now);
    const dateForFile = now.toISOString().split("T")[0];
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="finance-briefing-${dateForFile}.md"`,
      },
    });
  }
  if (mode === "expenses") {
    const markdown = await buildExpensesAnalysis(now);
    const dateForFile = now.toISOString().split("T")[0];
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="expenses-analysis-${dateForFile}.md"`,
      },
    });
  }
  if (mode === "debts") {
    const markdown = await buildDebtsStrategy(now);
    const dateForFile = now.toISOString().split("T")[0];
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="debt-strategy-${dateForFile}.md"`,
      },
    });
  }
  if (mode === "goals") {
    const markdown = await buildGoalsForecast(now);
    const dateForFile = now.toISOString().split("T")[0];
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="goals-forecast-${dateForFile}.md"`,
      },
    });
  }

  const periodStart = new Date(now);
  periodStart.setMonth(periodStart.getMonth() - 3);

  const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getExchangeRates()]);

  const [
    vaults,
    transactions,
    recurringIncomes,
    subscriptions,
    liabilities,
    goals,
    plannedExpenses,
    baseCurrencySetting,
    budgetDeviations,
  ] = await Promise.all([
    prisma.vault.findMany({
      where: { isActive: true },
      include: { assets: { where: { isActive: true }, select: { currentTotalValue: true, currency: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.transaction.findMany({
      where: {
        type: { in: ["income", "expense", "transfer"] },
        date: { gte: periodStart },
      },
      include: { category: true, fromVault: true, toVault: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.recurringIncome.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.subscription.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.liability.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.goal.findMany({ where: { isCompleted: false }, orderBy: { createdAt: "asc" } }),
    prisma.plannedExpense.findMany({
      where: { isPaid: false, dueDate: { gt: now } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.appSettings.findUnique({ where: { key: "baseCurrency" } }),
    getCategoryBudgetDeviations(now, baseCurrency, rates),
  ]);

  const base = baseCurrencySetting?.value ?? baseCurrency;

  const vaultRows = vaults.map((vault) => {
    const native = getVaultBalance(vault, rates);
    const inBase = convertAmount(native.balance, native.currency, base, rates);
    return {
      name: vault.name,
      type: vault.type,
      currency: native.currency,
      balance: native.balance,
      balanceInBase: inBase,
    };
  });
  const netWorth = vaultRows.reduce((sum, v) => sum + v.balanceInBase, 0);

  const recurringRows = recurringIncomes.map((item) => {
    const monthly = convertAmount(item.amount * toMonthlyFactor(item.billingPeriod), item.currency, base, rates);
    return {
      name: item.name,
      amount: item.amount,
      currency: item.currency,
      period: periodLabel(item.billingPeriod),
      category: item.category,
      monthlyInBase: monthly,
    };
  });
  const monthlyIncome = recurringRows.reduce((sum, row) => sum + row.monthlyInBase, 0);

  const subscriptionRows = subscriptions.map((item) => {
    const monthly = convertAmount(item.amount * toMonthlyFactor(item.billingPeriod), item.currency, base, rates);
    return {
      name: item.name,
      amount: item.amount,
      currency: item.currency,
      period: periodLabel(item.billingPeriod),
      nextChargeDate: item.nextChargeDate,
      monthlyInBase: monthly,
    };
  });
  const monthlySubscriptions = subscriptionRows.reduce((sum, row) => sum + row.monthlyInBase, 0);

  const liabilityRows = liabilities.map((item) => {
    const balanceInBase = convertAmount(item.currentBalance, item.currency, base, rates);
    const minPaymentInBase = convertAmount(item.minimumPayment ?? 0, item.currency, base, rates);
    return {
      name: item.name,
      balance: item.currentBalance,
      currency: item.currency,
      interestRate: item.interestRate,
      minPayment: item.minimumPayment,
      nextPaymentDate: item.nextPaymentDate,
      balanceInBase,
      minPaymentInBase,
    };
  });
  const totalLiabilities = liabilityRows.reduce((sum, row) => sum + row.balanceInBase, 0);
  const monthlyMinPayments = liabilityRows.reduce((sum, row) => sum + row.minPaymentInBase, 0);

  const goalRows = goals.map((goal) => {
    const percent = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    return { ...goal, percent };
  });

  const plannedRows = plannedExpenses.map((item) => ({
    ...item,
    daysLeft: item.dueDate ? daysUntil(item.dueDate, now) : null,
  }));

  const txSummary = transactions.reduce(
    (acc, tx) => {
      const type = tx.type as TxType;
      if (type === "income") {
        acc.income += convertAmount(tx.amount, tx.currency, base, rates);
      } else if (type === "expense") {
        acc.expense += convertAmount(tx.amount, tx.currency, base, rates);
      } else {
        acc.transfers += 1;
      }
      return acc;
    },
    { income: 0, expense: 0, transfers: 0 }
  );

  const byMonth = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    const existing = byMonth.get(key);
    if (existing) {
      existing.push(tx);
    } else {
      byMonth.set(key, [tx]);
    }
  }

  const monthSections = [...byMonth.entries()]
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map((entry) => {
      const rows = entry[1];
      const title = monthHeader(rows[0].date);
      const lines = rows
        .map((tx) => {
          const type = tx.type as TxType;
          const baseDescription = type === "transfer" ? "Перевод" : "Операция";
          const note = tx.note?.trim();
          const description = note ? `${baseDescription} (${note})` : baseDescription;
          const cleanedDescription = cleanDescription(description);
          const categoryName = tx.category?.name ?? "[без категории]";
          return `${formatDateShort(tx.date)} | ${txTypeLabel(type)} | ${categoryName} | ${txSignedAmount(type, tx.amount, tx.currency)} | ${cleanedDescription}`;
        })
        .join("\n");

      return `### ${title}
${lines}`;
    })
    .join("\n\n");

  const markdown = `# Финансовый отчёт
Дата: ${formatDateLongRu(now)}
Базовая валюта: ${base}

---

## Хранилища и капитал

| Хранилище | Тип | Валюта | Баланс | В базовой валюте |
|-----------|-----|--------|--------|-----------------|
${vaultRows
  .map(
    (row) =>
      `| ${row.name} | ${row.type} | ${row.currency} | ${formatMoney(row.balance, row.currency)} | ${formatMoney(row.balanceInBase, base)} |`
  )
  .join("\n")}

**Чистый капитал: ${formatMoney(netWorth, base)}**

---

## Регулярные доходы

| Источник | Сумма | Период | Категория |
|----------|-------|--------|-----------|
${recurringRows
  .map((row) => `| ${row.name} | ${formatMoney(row.amount, row.currency)} | ${row.period} | ${row.category} |`)
  .join("\n")}

**Итого доходов в месяц: ${formatMoney(monthlyIncome, base)}**

---

## Регулярные расходы (подписки)

| Название | Сумма | Период | Следующее списание |
|----------|-------|--------|--------------------|
${subscriptionRows
  .map(
    (row) =>
      `| ${row.name} | ${formatMoney(row.amount, row.currency)} | ${row.period} | ${formatDateFull(row.nextChargeDate)} |`
  )
  .join("\n")}

**Итого расходов в месяц: ${formatMoney(monthlySubscriptions, base)}**

---

## Обязательства (кредиты и долги)

| Название | Остаток | Ставка | Мин. платёж | Следующий платёж |
|----------|---------|--------|-------------|-----------------|
${liabilityRows
  .map((row) => {
    const rate = row.interestRate == null ? "—" : `${row.interestRate}%`;
    const minPayment = row.minPayment == null ? "—" : formatMoney(row.minPayment, row.currency);
    const nextPayment = row.nextPaymentDate ? formatDateFull(row.nextPaymentDate) : "—";
    return `| ${row.name} | ${formatMoney(row.balance, row.currency)} | ${rate} | ${minPayment} | ${nextPayment} |`;
  })
  .join("\n")}

**Итого долгов: ${formatMoney(totalLiabilities, base)}**

---

## Цели накопления

| Цель | Накоплено | Нужно | % | Дата |
|------|-----------|-------|---|------|
${goalRows
  .map((row) => {
    const due = row.targetDate ? formatDateFull(row.targetDate) : "—";
    return `| ${row.name} | ${formatMoney(row.currentAmount, row.currency)} | ${formatMoney(row.targetAmount, row.currency)} | ${Math.round(row.percent)}% | ${due} |`;
  })
  .join("\n")}

---

## Запланированные платежи

| Платёж | Сумма | Дата | Дней до срока |
|--------|-------|------|---------------|
${plannedRows
  .map((row) => {
    const dueDate = row.dueDate ? formatDateFull(row.dueDate) : "—";
    const days = row.daysLeft == null ? "—" : `${row.daysLeft} дней`;
    return `| ${row.name} | ${formatMoney(row.amount, row.currency)} | ${dueDate} | ${days} |`;
  })
  .join("\n")}

---

## Бюджет по категориям (текущий месяц)

${budgetDeviations.length === 0
  ? "Лимиты по категориям не заданы."
  : budgetDeviations
      .map((b) => {
        const status = b.diff > 0 ? `перерасход ${formatMoney(b.diff, base)}` : "в рамках лимита";
        return `- ${b.category}: ${formatMoney(b.spent, base)} / ${formatMoney(b.limit, base)} (${status})`;
      })
      .join("\n")}

---

## Свободный денежный поток

- Регулярные доходы/мес: ${formatMoney(monthlyIncome, base)}
- Подписки/мес: -${formatMoney(monthlySubscriptions, base)}
- Мин. платежи по кредитам/мес: -${formatMoney(monthlyMinPayments, base)}
- **СДП: ${formatMoney(monthlyIncome - monthlySubscriptions - monthlyMinPayments, base)}/мес**

---

## Все транзакции за последние 3 месяца

> Всего транзакций: ${transactions.length} | Доходы: ${formatMoney(txSummary.income, base)} | Расходы: ${formatMoney(txSummary.expense, base)} | Переводы: ${txSummary.transfers} шт

${monthSections}

---
*Отчёт сгенерирован приложением Finance Analytics*
`;

  const dateForFile = now.toISOString().split("T")[0];
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="finance-report-${dateForFile}.md"`,
    },
  });
}
