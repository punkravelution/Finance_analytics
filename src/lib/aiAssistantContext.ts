import { prisma } from "@/lib/prisma";
import { getVaultSummaries, getDashboardStats } from "@/lib/analytics";
import { getBaseCurrency, getExchangeRates, convertAmount, type ExchangeRateMap } from "@/lib/currency";
import { formatCurrency, formatDate } from "@/lib/format";
import { getTotalMonthlyIncome } from "@/app/actions/recurringIncome";
import { getGoalsProgress } from "@/app/actions/goal";
import { getCategoryBudgetMap } from "@/lib/categoryBudgets";

function monthlyFactorSubscription(period: string): number {
  if (period === "quarterly") return 1 / 3;
  if (period === "yearly") return 1 / 12;
  return 1;
}

const RECURRING_PERIOD_RU: Record<string, string> = {
  monthly: "ежемесячно",
  weekly: "еженедельно",
  yearly: "ежегодно",
  biweekly: "раз в две недели",
};

const RECURRING_CATEGORY_RU: Record<string, string> = {
  salary: "Зарплата",
  freelance: "Фриланс",
  rental: "Аренда",
  pension: "Пенсия",
  business: "Бизнес",
  other: "Другое",
};

const LIABILITY_TYPE_RU: Record<string, string> = {
  credit_card: "Кредитная карта",
  installment: "Рассрочка",
  loan: "Займ / кредит",
  other: "Другое",
};

async function getTopExpenseCategories(
  days: number,
  limit: number,
  baseCurrency: string,
  rates: ExchangeRateMap
): Promise<Array<{ name: string; totalInBase: number }>> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = await prisma.transaction.findMany({
    where: { type: "expense", date: { gte: since } },
    select: {
      amount: true,
      currency: true,
      category: { select: { name: true } },
    },
  });
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

async function getTransactionTotals90d(
  baseCurrency: string,
  rates: ExchangeRateMap
): Promise<{ incomeBase: number; expenseBase: number }> {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const rows = await prisma.transaction.findMany({
    where: {
      date: { gte: since },
      type: { in: ["income", "expense"] },
    },
    select: { type: true, amount: true, currency: true },
  });
  let incomeBase = 0;
  let expenseBase = 0;
  for (const r of rows) {
    const v = convertAmount(r.amount, r.currency, baseCurrency, rates);
    if (r.type === "income") incomeBase += v;
    else expenseBase += v;
  }
  return { incomeBase, expenseBase };
}


/** Текстовый снимок для подстановки в system prompt (русский). */
export async function buildFinancialContextForAi(): Promise<string> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getExchangeRates()]);

  const [
    vaultSummaries,
    dashboard,
    recurringIncomes,
    subscriptions,
    liabilities,
    goalsProgress,
    plannedUnpaid,
    assets,
    recurringTotals,
    topExpense90,
    tx90,
    linkedPlannedMonth,
    categoryBudgetMap,
    monthExpenseRows,
  ] = await Promise.all([
    getVaultSummaries(),
    getDashboardStats(),
    prisma.recurringIncome.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.subscription.findMany({
      where: { isActive: true },
      orderBy: { nextChargeDate: "asc" },
    }),
    prisma.liability.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    getGoalsProgress(),
    prisma.plannedExpense.findMany({
      where: { isPaid: false },
      orderBy: { dueDate: "asc" },
    }),
    prisma.asset.findMany({
      where: { isActive: true },
      include: { vault: { select: { name: true } } },
      orderBy: [{ vaultId: "asc" }, { name: "asc" }],
    }),
    getTotalMonthlyIncome(),
    getTopExpenseCategories(90, 5, baseCurrency, rates),
    getTransactionTotals90d(baseCurrency, rates),
    prisma.transaction.findMany({
      where: {
        type: "expense",
        plannedExpenseId: { not: null },
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { plannedExpenseId: true },
    }),
    getCategoryBudgetMap(),
    prisma.transaction.findMany({
      where: { type: "expense", date: { gte: monthStart, lte: monthEnd }, categoryId: { not: null } },
      select: {
        categoryId: true,
        amount: true,
        currency: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const lines: string[] = [];

  const DAY_MS = 24 * 60 * 60 * 1000;
  function startOfLocalDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function daysUntilDue(due: Date): number {
    const a = startOfLocalDay(now).getTime();
    const b = startOfLocalDay(due).getTime();
    return Math.round((b - a) / DAY_MS);
  }

  lines.push(`Базовая валюта приложения: ${baseCurrency}.`);
  lines.push("");

  // ─── A) Капитал и ликвидность ──────────────────────────────────────────────
  lines.push("=== А) КАПИТАЛ И ЛИКВИДНОСТЬ ===");
  lines.push(`Чистый капитал: ${formatCurrency(dashboard.totalNetWorth, baseCurrency)}`);
  const highLiquidity = vaultSummaries
    .filter((v) => v.liquidityLevel === "high")
    .reduce((sum, v) => sum + v.balanceInBaseCurrency, 0);
  const mediumLiquidity = vaultSummaries
    .filter((v) => v.liquidityLevel === "medium")
    .reduce((sum, v) => sum + v.balanceInBaseCurrency, 0);
  const lowLiquidity = vaultSummaries
    .filter((v) => v.liquidityLevel === "low" || v.liquidityLevel === "illiquid")
    .reduce((sum, v) => sum + v.balanceInBaseCurrency, 0);
  lines.push(`Ликвидные средства (high): ${formatCurrency(highLiquidity, baseCurrency)}`);
  lines.push(`Среднеликвидные (medium): ${formatCurrency(mediumLiquidity, baseCurrency)}`);
  lines.push(`Низколиквидные (low/illiquid): ${formatCurrency(lowLiquidity, baseCurrency)}`);

  const foreignCurrencyMap = new Map<string, number>();
  for (const v of vaultSummaries) {
    const code = v.balanceCurrency.trim().toUpperCase();
    if (!code || code === baseCurrency.toUpperCase()) continue;
    if (Math.abs(v.balance) <= 0) continue;
    foreignCurrencyMap.set(code, (foreignCurrencyMap.get(code) ?? 0) + v.balance);
  }
  if (foreignCurrencyMap.size > 0) {
    const foreignText = [...foreignCurrencyMap.entries()]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 6)
      .map(([code, amount]) => `${amount.toFixed(2)} ${code}`)
      .join(", ");
    lines.push(`Валютные активы: ${foreignText}`);
  }
  if (vaultSummaries.length <= 3) {
    lines.push("Детали хранилищ:");
    for (const v of vaultSummaries) {
      lines.push(
        `  — ${v.name}: ${formatCurrency(v.balance, v.balanceCurrency)} (≈ ${formatCurrency(v.balanceInBaseCurrency, baseCurrency)})`
      );
    }
  }
  lines.push("");

  // ─── В) Регулярные доходы ──────────────────────────────────────────────────
  lines.push("=== В) РЕГУЛЯРНЫЕ ДОХОДЫ ===");
  lines.push("Активные регулярные доходы (RecurringIncome):");
  for (const r of recurringIncomes) {
    const period = RECURRING_PERIOD_RU[r.billingPeriod] ?? r.billingPeriod;
    const cat = RECURRING_CATEGORY_RU[r.category] ?? r.category;
    lines.push(
      `  — «${r.name}»: ${formatCurrency(r.amount, r.currency)}, ${period}, категория: ${cat}, следующее поступление: ${formatDate(r.nextIncomeDate)}`
    );
  }
  if (recurringIncomes.length === 0) {
    lines.push("  (нет активных записей)");
  }
  lines.push(
    `Итого регулярные доходы в текущем месяце (оценка приложения, в ${baseCurrency}): ${formatCurrency(recurringTotals.totalMonthly, baseCurrency)}.`
  );
  lines.push("");

  // ─── Б) Регулярные расходы ─────────────────────────────────────────────────
  lines.push("=== Б) РЕГУЛЯРНЫЕ РАСХОДЫ ===");
  let subscriptionsMonthlyBase = 0;
  const subscriptionMonthlyRows: Array<{ name: string; monthlyBase: number }> = [];
  for (const s of subscriptions) {
    const factor = monthlyFactorSubscription(s.billingPeriod);
    const monthlyNative = s.amount * factor;
    const monthlyBase = convertAmount(monthlyNative, s.currency, baseCurrency, rates);
    subscriptionsMonthlyBase += monthlyBase;
    subscriptionMonthlyRows.push({ name: s.name, monthlyBase });
  }
  lines.push(`Подписок активных: ${subscriptions.length} штук на ${formatCurrency(subscriptionsMonthlyBase, baseCurrency)}/мес`);
  const topSubscriptions = subscriptionMonthlyRows
    .filter((x) => x.monthlyBase > 500)
    .sort((a, b) => b.monthlyBase - a.monthlyBase)
    .slice(0, 2);
  if (topSubscriptions.length > 0) {
    lines.push(
      `Самые крупные: ${topSubscriptions
        .map((s) => `${s.name} ${formatCurrency(s.monthlyBase, baseCurrency)}`)
        .join(", ")}`
    );
  }

  const freeCashFlow = recurringTotals.totalMonthly - subscriptionsMonthlyBase;
  lines.push(
    `Свободный денежный поток (регулярные доходы за месяц минус подписки за месяц, в ${baseCurrency}): ${formatCurrency(freeCashFlow, baseCurrency)}.`
  );
  lines.push("");

  lines.push("");

  // ─── Д) Обязательства ───────────────────────────────────────────────────────
  lines.push("=== Д) ОБЯЗАТЕЛЬСТВА (долги и кредиты) ===");
  let totalDebtBase = 0;
  let weightedRateNumerator = 0;
  let weightedRateDenominator = 0;

  for (const l of liabilities) {
    const balBase = convertAmount(l.currentBalance, l.currency, baseCurrency, rates);
    totalDebtBase += balBase;
    const rate = l.interestRate;
    if (rate != null && Number.isFinite(rate) && balBase > 0) {
      weightedRateNumerator += rate * balBase;
      weightedRateDenominator += balBase;
    }
    const minPay = l.minimumPayment ?? 0;
    const typeLabel = LIABILITY_TYPE_RU[l.type] ?? l.type;
    lines.push(
      `  — «${l.name}» (${typeLabel}): остаток ${formatCurrency(l.currentBalance, l.currency)} (≈ ${formatCurrency(balBase, baseCurrency)}), ставка: ${rate != null && Number.isFinite(rate) ? `${rate}%` : "не указана"}, мин. платёж: ${formatCurrency(minPay, l.currency)}, следующий платёж: ${l.nextPaymentDate ? formatDate(l.nextPaymentDate) : "не задан"}`
    );
  }
  if (liabilities.length === 0) {
    lines.push("  (нет активных обязательств)");
  }
  lines.push(`Итого долги (в ${baseCurrency}): ${formatCurrency(totalDebtBase, baseCurrency)}.`);
  const avgRate =
    weightedRateDenominator > 0 ? weightedRateNumerator / weightedRateDenominator : null;
  lines.push(
    `Средневзвешенная процентная ставка по долгам с указанной ставкой: ${avgRate != null && Number.isFinite(avgRate) ? `${avgRate.toFixed(2)}%` : "невозможно посчитать (нет ставок или сумм)"}.`
  );
  lines.push("");

  // ─── Е) Цели ──────────────────────────────────────────────────────────────
  lines.push("=== Е) ЦЕЛИ ===");
  for (const g of goalsProgress) {
    const deadline =
      g.targetDate != null
        ? `${formatDate(g.targetDate)} (дней до дедлайна: ${g.daysUntilTarget ?? "—"})`
        : "без дедлайна";
    const needMonth =
      g.monthlyRequired != null
        ? `${formatCurrency(g.monthlyRequired, g.currency)} (≈ ${formatCurrency(convertAmount(g.monthlyRequired, g.currency, baseCurrency, rates), baseCurrency)} в базовой)`
        : "—";
    let feasibility: string;
    if (g.isCompleted) {
      feasibility = "цель выполнена";
    } else if (g.monthlyRequired == null || !Number.isFinite(g.monthlyRequired)) {
      feasibility =
        "оценка при текущем СДП: нет даты цели — не сравнивалось с ежемесячным свободным потоком";
    } else {
      const needBase = convertAmount(g.monthlyRequired, g.currency, baseCurrency, rates);
      if (freeCashFlow <= 0) {
        feasibility = `при текущем СДП (${formatCurrency(freeCashFlow, baseCurrency)}/мес) откладывать ${formatCurrency(needBase, baseCurrency)}/мес по этой цели не выходит — сначала нужно увеличить доходы или снизить обязательные расходы`;
      } else if (needBase > freeCashFlow) {
        feasibility = `при одной только этой цели: нужно ≈ ${formatCurrency(needBase, baseCurrency)}/мес, а свободный поток ≈ ${formatCurrency(freeCashFlow, baseCurrency)}/мес — не хватает`;
      } else {
        feasibility = `теоретически достижимо за счёт текущего СДП: нужно ≈ ${formatCurrency(needBase, baseCurrency)}/мес при СДП ≈ ${formatCurrency(freeCashFlow, baseCurrency)}/мес (если направить весь СДП только на эту цель; при нескольких целях потребуется приоритизация)`;
      }
    }
    lines.push(
      `  — «${g.name}»: цель ${formatCurrency(g.targetAmount, g.currency)}, накоплено ${formatCurrency(g.currentAmount, g.currency)} (${g.percentComplete.toFixed(1)}%), дедлайн: ${deadline}, оценка «нужно в месяц» до дедлайна: ${needMonth}`
    );
    lines.push(`    Достижимость при текущем свободном денежном потоке: ${feasibility}.`);
  }
  if (goalsProgress.length === 0) {
    lines.push("  (целей нет)");
  }
  lines.push("");

  // ─── Ж) Запланированные платежи ───────────────────────────────────────────
  lines.push("=== Ж) ЗАПЛАНИРОВАННЫЕ ПЛАТЕЖИ (неоплаченные) ===");
  const overdue: typeof plannedUnpaid = [];
  const within30: typeof plannedUnpaid = [];
  const later: typeof plannedUnpaid = [];
  const noSpecificDate: typeof plannedUnpaid = [];
  for (const p of plannedUnpaid) {
    if (p.dueDate == null) {
      noSpecificDate.push(p);
      continue;
    }
    const d = daysUntilDue(p.dueDate);
    if (d < 0) overdue.push(p);
    else if (d <= 30) within30.push(p);
    else later.push(p);
  }
  if (overdue.length > 0) {
    lines.push("ПРОСРОЧЕНО:");
    for (const p of overdue) {
      if (p.dueDate == null) continue;
      const d = daysUntilDue(p.dueDate);
      lines.push(
        `  — «${p.name}»: ${formatCurrency(p.amount, p.currency)}, было к оплате ${formatDate(p.dueDate)} (${d} дн. от срока)`
      );
    }
  } else {
    lines.push("Просроченных неоплаченных платежей нет.");
  }
  if (within30.length > 0) {
    lines.push("В ближайшие 30 дней:");
    for (const p of within30) {
      if (p.dueDate == null) continue;
      const d = daysUntilDue(p.dueDate);
      lines.push(
        `  — «${p.name}»: ${formatCurrency(p.amount, p.currency)}, срок ${formatDate(p.dueDate)} (через ${d} дн.)`
      );
    }
  } else {
    lines.push("В ближайшие 30 дней неоплаченных запланированных платежей нет.");
  }
  if (later.length > 0) {
    lines.push("Далее по сроку (после 30 дней):");
    for (const p of later.slice(0, 15)) {
      if (p.dueDate == null) continue;
      const d = daysUntilDue(p.dueDate);
      lines.push(
        `  — «${p.name}»: ${formatCurrency(p.amount, p.currency)}, срок ${formatDate(p.dueDate)} (через ${d} дн.)`
      );
    }
    if (later.length > 15) {
      lines.push(`  … и ещё ${later.length - 15} записей.`);
    }
  }
  if (noSpecificDate.length > 0) {
    lines.push("Без конкретной даты (срок не задан):");
    for (const p of noSpecificDate) {
      lines.push(`  — «${p.name}»: ${formatCurrency(p.amount, p.currency)}`);
    }
  }
  lines.push("");

  const distinctPlannedPaidThisMonth = new Set(
    linkedPlannedMonth
      .map((t) => t.plannedExpenseId)
      .filter((id): id is string => id != null)
  );
  lines.push(
    "Сверка неоплаченных запланированных платежей с расходами в текущем месяце (привязка plannedExpenseId):"
  );
  let plannedWithTxThisMonth = 0;
  for (const p of plannedUnpaid) {
    const linked = distinctPlannedPaidThisMonth.has(p.id);
    if (linked) plannedWithTxThisMonth += 1;
    const duePhrase =
      p.dueDate != null ? `к оплате ${formatDate(p.dueDate)}` : "без даты";
    lines.push(
      `  — «${p.name}» (${duePhrase}): есть расход с привязкой в этом месяце: ${linked ? "да" : "нет"}`
    );
  }
  if (plannedUnpaid.length === 0) {
    lines.push("  (неоплаченных запланированных платежей нет)");
  }
  lines.push(
    `Итог по неоплаченным планам: записей ${plannedUnpaid.length}, из них с подтверждающей транзакцией в текущем месяце: ${plannedWithTxThisMonth}.`
  );
  lines.push("");

  // ─── З) Транзакции (только агрегаты) ───────────────────────────────────────
  lines.push("=== З) ТРАНЗАКЦИИ (агрегаты за 3 месяца) ===");
  if (topExpense90.length === 0) {
    lines.push("Топ-5 категорий расходов: нет расходных операций за период.");
  } else {
    lines.push("Топ-5 категорий расходов:");
    topExpense90.forEach((c, i) => {
      lines.push(`  ${i + 1}. ${c.name}: ${formatCurrency(c.totalInBase, baseCurrency)}`);
    });
  }
  const avgIncome = tx90.incomeBase / 3;
  const avgExpense = tx90.expenseBase / 3;
  lines.push(`Среднемесячный доход (3 мес): ${formatCurrency(avgIncome, baseCurrency)}.`);
  lines.push(`Среднемесячный расход (3 мес): ${formatCurrency(avgExpense, baseCurrency)}.`);
  lines.push("");

  lines.push("=== J) ВРЕМЕННОЙ КОНТЕКСТ И РАСШИРЕННЫЙ СВОБОДНЫЙ ДЕНЕЖНЫЙ ПОТОК ===");
  lines.push(`Сегодня (локально): ${now.toLocaleDateString("ru-RU")}.`);

  const salaryRows = recurringIncomes.filter((r) => r.category === "salary" && r.isActive);
  if (salaryRows.length === 0) {
    lines.push(
      "Дней до следующей зарплаты: не вычисляется — нет активного RecurringIncome с категорией «salary»."
    );
  } else {
    const nextSal = [...salaryRows].sort(
      (a, b) => a.nextIncomeDate.getTime() - b.nextIncomeDate.getTime()
    )[0];
    if (nextSal) {
      const dSal = daysUntilDue(nextSal.nextIncomeDate);
      lines.push(
        `Ближайшая зарплата (справочник): «${nextSal.name}», дата ${formatDate(nextSal.nextIncomeDate)}, дней от сегодня: ${dSal}.`
      );
    }
  }

  const liabDates = liabilities
    .map((l) => l.nextPaymentDate)
    .filter((d): d is Date => d != null);
  const nearestLiabDate =
    liabDates.length > 0
      ? liabDates.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b))
      : null;
  if (nearestLiabDate) {
    lines.push(
      `Ближайший платёж по обязательству (Liability.nextPaymentDate): ${formatDate(nearestLiabDate)}, дней: ${daysUntilDue(nearestLiabDate)}.`
    );
  } else {
    lines.push(
      "Ближайший платёж по обязательству: не задан (у активных долгов нет nextPaymentDate)."
    );
  }

  const plannedDates = plannedUnpaid
    .map((p) => p.dueDate)
    .filter((d): d is Date => d != null);
  const nearestPlannedDate =
    plannedDates.length > 0
      ? plannedDates.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b))
      : null;
  if (nearestPlannedDate) {
    lines.push(
      `Ближайший запланированный платёж (PlannedExpense): ${formatDate(nearestPlannedDate)}, дней: ${daysUntilDue(nearestPlannedDate)}.`
    );
  } else {
    lines.push(
      "Ближайший запланированный платёж: нет неоплаченных PlannedExpense с указанной датой."
    );
  }

  let minPaymentsMonthlyBase = 0;
  for (const l of liabilities) {
    const mp = l.minimumPayment ?? 0;
    minPaymentsMonthlyBase += convertAmount(mp, l.currency, baseCurrency, rates);
  }
  const fcfStrict =
    recurringTotals.totalMonthly - subscriptionsMonthlyBase - minPaymentsMonthlyBase;
  let goalsMonthlyNeedBase = 0;
  for (const g of goalsProgress) {
    if (g.isCompleted) continue;
    if (g.monthlyRequired == null || !Number.isFinite(g.monthlyRequired)) continue;
    goalsMonthlyNeedBase += convertAmount(g.monthlyRequired, g.currency, baseCurrency, rates);
  }
  const remainderAfterGoals = fcfStrict - goalsMonthlyNeedBase;
  lines.push(
    `СДП (строго): регулярные доходы/мес ${formatCurrency(recurringTotals.totalMonthly, baseCurrency)} − подписки/мес ${formatCurrency(subscriptionsMonthlyBase, baseCurrency)} − мин. платежи по долгам/мес ${formatCurrency(minPaymentsMonthlyBase, baseCurrency)} = ${formatCurrency(fcfStrict, baseCurrency)}.`
  );
  lines.push(
    `Оценка взносов на цели (сумма «нужно в месяц» по незавершённым целям с дедлайном, в ${baseCurrency}): ${formatCurrency(goalsMonthlyNeedBase, baseCurrency)}.`
  );
  lines.push(
    `Остаток после целей (СДП − взносы на цели): ${formatCurrency(remainderAfterGoals, baseCurrency)}.`
  );
  lines.push("");

  // ─── Г) Инвестиционный портфель ─────────────────────────────────────────────
  lines.push("=== Г) ИНВЕСТИЦИОННЫЙ ПОРТФЕЛЬ ===");
  let portfolioBase = 0;
  let stocksBase = 0;
  let cryptoBase = 0;
  let otherBase = 0;
  for (const a of assets) {
    const nativeValue =
      a.currentTotalValue != null && Number.isFinite(a.currentTotalValue)
        ? a.currentTotalValue
        : a.quantity * (a.currentUnitPrice ?? 0);
    const valBase = convertAmount(nativeValue, a.currency, baseCurrency, rates);
    portfolioBase += valBase;
    if (a.assetType === "stock") stocksBase += valBase;
    else if (a.assetType === "crypto") cryptoBase += valBase;
    else otherBase += valBase;
  }
  lines.push(`Активов всего: ${assets.length} позиций`);
  lines.push(`Общая стоимость портфеля: ${formatCurrency(portfolioBase, baseCurrency)}`);
  lines.push(
    `По типам: акции ${formatCurrency(stocksBase, baseCurrency)}, крипта ${formatCurrency(cryptoBase, baseCurrency)}, прочее ${formatCurrency(otherBase, baseCurrency)}`
  );
  lines.push("");

  // ─── K) Финансовые метрики и аномалии ───────────────────────────────────────
  lines.push("");
  lines.push("=== К) ФИНАНСОВЫЕ МЕТРИКИ И АНОМАЛИИ ===");

  // 1) Правило 50/30/20
  try {
    const needsKeywords = ["продукты", "жкх", "транспорт", "здоровье", "связь", "кредит", "рассрочка"];
    const wantsKeywords = ["кафе", "рестораны", "развлечения", "подписки", "одежда", "доставка", "такси"];
    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    const expense30 = await prisma.transaction.findMany({
      where: { type: "expense", date: { gte: since30 } },
      select: {
        amount: true,
        currency: true,
        category: { select: { name: true } },
      },
    });

    let needsBase = 0;
    let wantsBase = 0;
    for (const row of expense30) {
      const categoryName = (row.category?.name ?? "").toLocaleLowerCase("ru-RU");
      const valueBase = convertAmount(row.amount, row.currency, baseCurrency, rates);
      const isWants = wantsKeywords.some((k) => categoryName.includes(k));
      const isNeeds = needsKeywords.some((k) => categoryName.includes(k));
      if (isWants) wantsBase += valueBase;
      else if (isNeeds) needsBase += valueBase;
      else needsBase += valueBase;
    }
    const monthlyIncomeBase = recurringTotals.totalMonthly;
    if (monthlyIncomeBase > 0) {
      const needsPct = (needsBase / monthlyIncomeBase) * 100;
      const wantsPct = (wantsBase / monthlyIncomeBase) * 100;
      const savingsPct = 100 - needsPct - wantsPct;
      lines.push(
        `[50/30/20] Нужды: ${needsPct.toFixed(1)}% (норма 50%), Желания: ${wantsPct.toFixed(1)}% (норма 30%), Накопления: ${savingsPct.toFixed(1)}% (норма 20%)`
      );
      const wantsDeviation = wantsPct - 30;
      if (wantsDeviation > 10) {
        lines.push(`⚠️ Желания превышают норму на ${wantsDeviation.toFixed(1)}%`);
      }
    }
  } catch {
    // пропускаем метрику при недостатке данных
  }

  // 2) Подушка безопасности
  let cushionMonths: number | null = null;
  try {
    const liquidBalanceBase = vaultSummaries
      .filter((v) => v.liquidityLevel === "high")
      .reduce((sum, v) => sum + v.balanceInBaseCurrency, 0);
    const avgExpense90 = tx90.expenseBase / 3;
    if (avgExpense90 > 0) {
      cushionMonths = liquidBalanceBase / avgExpense90;
      lines.push(`Подушка безопасности: ${cushionMonths.toFixed(1)} мес (норма 3–6 мес)`);
      if (cushionMonths < 1) {
        lines.push("🚨 КРИТИЧНО: подушка менее 1 месяца");
      } else if (cushionMonths < 3) {
        lines.push(`⚠️ Подушка недостаточна: ${cushionMonths.toFixed(1)} мес из 3 необходимых`);
      } else {
        lines.push(`✅ Подушка в норме: ${cushionMonths.toFixed(1)} мес`);
      }
    }
  } catch {
    // пропускаем метрику при недостатке данных
  }

  // 3) Долговая нагрузка
  let debtServicePct: number | null = null;
  let debtMinPaymentsMonthlyBase = 0;
  try {
    for (const l of liabilities) {
      const mp = l.minimumPayment ?? 0;
      debtMinPaymentsMonthlyBase += convertAmount(mp, l.currency, baseCurrency, rates);
    }
    const monthlyIncomeBase = recurringTotals.totalMonthly;
    if (monthlyIncomeBase > 0) {
      debtServicePct = (debtMinPaymentsMonthlyBase / monthlyIncomeBase) * 100;
      lines.push(`Долговая нагрузка: ${debtServicePct.toFixed(1)}% от дохода (норма до 30%)`);
      if (debtServicePct > 40) {
        lines.push(`🚨 КРИТИЧНО: долговая нагрузка ${debtServicePct.toFixed(1)}%`);
      } else if (debtServicePct > 30) {
        lines.push(`⚠️ Долговая нагрузка повышена: ${debtServicePct.toFixed(1)}%`);
      } else {
        lines.push(`✅ Долговая нагрузка в норме: ${debtServicePct.toFixed(1)}%`);
      }
    }
  } catch {
    // пропускаем метрику при недостатке данных
  }

  // 4) Аномалии расходов по категориям
  try {
    const nowDate = new Date();
    const currentStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1, 0, 0, 0, 0);
    const previousStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1, 0, 0, 0, 0);
    const previousEnd = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1, 0, 0, 0, 0);
    const currentRows = await prisma.transaction.findMany({
      where: {
        type: "expense",
        date: { gte: currentStart, lte: nowDate },
      },
      select: {
        amount: true,
        currency: true,
        category: { select: { name: true } },
      },
    });
    const previousRows = await prisma.transaction.findMany({
      where: {
        type: "expense",
        date: { gte: previousStart, lt: previousEnd },
      },
      select: {
        amount: true,
        currency: true,
        category: { select: { name: true } },
      },
    });

    const currentByCat = new Map<string, number>();
    const previousByCat = new Map<string, number>();
    for (const row of currentRows) {
      const category = row.category?.name ?? "Без категории";
      const v = convertAmount(row.amount, row.currency, baseCurrency, rates);
      currentByCat.set(category, (currentByCat.get(category) ?? 0) + v);
    }
    for (const row of previousRows) {
      const category = row.category?.name ?? "Без категории";
      const v = convertAmount(row.amount, row.currency, baseCurrency, rates);
      previousByCat.set(category, (previousByCat.get(category) ?? 0) + v);
    }

    const anomalies: Array<{ category: string; growthPct: number; prev: number; curr: number }> = [];
    for (const [category, curr] of currentByCat.entries()) {
      const prev = previousByCat.get(category) ?? 0;
      if (prev <= 0) continue;
      const growthPct = ((curr - prev) / prev) * 100;
      if (growthPct > 30) {
        anomalies.push({ category, growthPct, prev, curr });
      }
    }
    anomalies
      .sort((a, b) => b.growthPct - a.growthPct)
      .slice(0, 3)
      .forEach((a) => {
        lines.push(
          `⚠️ [${a.category}]: рост на ${a.growthPct.toFixed(1)}% (было ${formatCurrency(a.prev, baseCurrency)}, стало ${formatCurrency(a.curr, baseCurrency)})`
        );
      });
  } catch {
    // пропускаем метрику при недостатке данных
  }

  // 5) Приближающиеся обязательства + кассовый разрыв
  try {
    const nowDate = new Date();
    const in30 = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 30, 23, 59, 59, 999);
    const in14 = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 14, 23, 59, 59, 999);
    const plannedSoon = await prisma.plannedExpense.findMany({
      where: {
        isPaid: false,
        dueDate: { gte: nowDate, lte: in30 },
      },
      select: { name: true, amount: true, currency: true, dueDate: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    });
    const liabilitiesSoon = await prisma.liability.findMany({
      where: {
        isActive: true,
        nextPaymentDate: { gte: nowDate, lte: in14 },
      },
      select: { name: true, minimumPayment: true, currency: true, nextPaymentDate: true },
      orderBy: { nextPaymentDate: "asc" },
      take: 10,
    });

    const DAY_MS_LOCAL = 24 * 60 * 60 * 1000;
    const toDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    let obligationsBase = 0;
    for (const p of plannedSoon) {
      if (!p.dueDate) continue;
      const days = Math.round((toDay(p.dueDate) - toDay(nowDate)) / DAY_MS_LOCAL);
      const amountBase = convertAmount(p.amount, p.currency, baseCurrency, rates);
      obligationsBase += amountBase;
      lines.push(`⏰ Платёж '${p.name}' через ${days} дней: ${formatCurrency(amountBase, baseCurrency)}`);
    }
    for (const l of liabilitiesSoon) {
      if (!l.nextPaymentDate) continue;
      const days = Math.round((toDay(l.nextPaymentDate) - toDay(nowDate)) / DAY_MS_LOCAL);
      const payment = l.minimumPayment ?? 0;
      const paymentBase = convertAmount(payment, l.currency, baseCurrency, rates);
      obligationsBase += paymentBase;
      lines.push(`⏰ Платёж по '${l.name}' через ${days} дней: ${formatCurrency(paymentBase, baseCurrency)}`);
    }

    const totalBalanceBase = vaultSummaries.reduce((sum, v) => sum + v.balanceInBaseCurrency, 0);
    if (obligationsBase > 0 && totalBalanceBase < obligationsBase) {
      lines.push(
        `🚨 КАССОВЫЙ РАЗРЫВ: обязательства ${formatCurrency(obligationsBase, baseCurrency)}, доступно ${formatCurrency(totalBalanceBase, baseCurrency)}`
      );
    }
  } catch {
    // пропускаем метрику при недостатке данных
  }

  // 6) FCF
  let fcf: number | null = null;
  try {
    const monthlyIncomeBase = recurringTotals.totalMonthly;
    let subscriptionsMonthlyBase = 0;
    for (const s of subscriptions) {
      const factor = monthlyFactorSubscription(s.billingPeriod);
      const monthlyNative = s.amount * factor;
      subscriptionsMonthlyBase += convertAmount(monthlyNative, s.currency, baseCurrency, rates);
    }
    fcf = monthlyIncomeBase - subscriptionsMonthlyBase - debtMinPaymentsMonthlyBase;
    lines.push(`Свободный денежный поток: ${formatCurrency(fcf, baseCurrency)}/мес`);
    if (fcf < 0) {
      lines.push("🚨 FCF отрицательный: расходы превышают доход");
    }
  } catch {
    // пропускаем метрику при недостатке данных
  }

  // 7) Инвестиционная иерархия
  try {
    const highRateDebt = liabilities
      .filter(
        (l) =>
          l.isActive &&
          l.currentBalance > 0 &&
          l.interestRate != null &&
          Number.isFinite(l.interestRate) &&
          l.interestRate > 10
      )
      .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0];

    if (cushionMonths != null && cushionMonths < 3) {
      lines.push("📍 Приоритет: наращивание подушки безопасности");
    } else if (highRateDebt) {
      lines.push(
        `📍 Приоритет: погашение долга '${highRateDebt.name}' (ставка ${(highRateDebt.interestRate ?? 0).toFixed(1)}%)`
      );
    } else if (cushionMonths != null && cushionMonths >= 3) {
      lines.push("📍 Приоритет: можно инвестировать свободный поток");
    }
  } catch {
    // пропускаем метрику при недостатке данных
  }

  // 8) Отклонения от бюджета категорий
  try {
    const spentByCategory = new Map<string, { name: string; spent: number }>();
    for (const tx of monthExpenseRows) {
      if (!tx.categoryId) continue;
      const spent = convertAmount(tx.amount, tx.currency, baseCurrency, rates);
      const prev = spentByCategory.get(tx.categoryId) ?? {
        name: tx.category?.name ?? "Без категории",
        spent: 0,
      };
      prev.spent += spent;
      spentByCategory.set(tx.categoryId, prev);
    }
    const deviations = Object.entries(categoryBudgetMap)
      .map(([categoryId, limit]) => {
        const row = spentByCategory.get(categoryId);
        if (!row) return null;
        const diff = row.spent - limit;
        return { name: row.name, spent: row.spent, limit, diff };
      })
      .filter((x): x is { name: string; spent: number; limit: number; diff: number } => x !== null)
      .filter((x) => x.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 5);
    if (deviations.length > 0) {
      lines.push("Бюджеты категорий (превышение):");
      deviations.forEach((d) => {
        lines.push(
          `⚠️ [Бюджет] ${d.name}: ${formatCurrency(d.spent, baseCurrency)} из ${formatCurrency(d.limit, baseCurrency)} (перерасход ${formatCurrency(d.diff, baseCurrency)})`
        );
      });
    }
  } catch {
    // пропускаем метрику при недостатке данных
  }

  return lines.join("\n");
}
