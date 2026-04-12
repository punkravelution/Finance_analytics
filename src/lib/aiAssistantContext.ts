import { prisma } from "@/lib/prisma";
import { getVaultSummaries, getDashboardStats } from "@/lib/analytics";
import { getBaseCurrency, getExchangeRates, convertAmount, type ExchangeRateMap } from "@/lib/currency";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";
import { getTotalMonthlyIncome } from "@/app/actions/recurringIncome";
import { getGoalsProgress } from "@/app/actions/goal";
import {
  ASSET_TYPE_LABELS,
  VAULT_TYPE_LABELS,
  type AssetType,
  type VaultType,
} from "@/types";

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

const SUBSCRIPTION_PERIOD_RU: Record<string, string> = {
  monthly: "ежемесячно",
  quarterly: "ежеквартально",
  yearly: "ежегодно",
};

const LIABILITY_TYPE_RU: Record<string, string> = {
  credit_card: "Кредитная карта",
  installment: "Рассрочка",
  loan: "Займ / кредит",
  other: "Другое",
};

function vaultAggregateBucket(type: string): "bank" | "crypto" | "investments" | "cash" | "other" {
  if (type === "bank") return "bank";
  if (type === "crypto") return "crypto";
  if (type === "investment" || type === "deposit") return "investments";
  if (type === "cash") return "cash";
  return "other";
}

const BUCKET_LABEL: Record<ReturnType<typeof vaultAggregateBucket>, string> = {
  bank: "Банк",
  crypto: "Крипто",
  investments: "Инвестиции и вклады",
  cash: "Наличные",
  other: "Прочее (Steam, имущество, другое)",
};

function assetDisplayValue(a: {
  quantity: number;
  currentTotalValue: number | null;
  currentUnitPrice: number | null;
}): number {
  if (a.currentTotalValue != null && Number.isFinite(a.currentTotalValue)) {
    return a.currentTotalValue;
  }
  const unit = a.currentUnitPrice ?? 0;
  return a.quantity * unit;
}

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

interface MonthWindow {
  key: string;
  titleLong: string;
  labelShort: string;
  start: Date;
  end: Date;
}

function capitalizeFirstRu(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase("ru-RU") + s.slice(1);
}

function buildThreeMonthWindows(now: Date): MonthWindow[] {
  const out: MonthWindow[] = [];
  for (let offset = 2; offset >= 0; offset -= 1) {
    const ref = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const y = ref.getFullYear();
    const m = ref.getMonth();
    const start = new Date(y, m, 1, 0, 0, 0, 0);
    const isCurrent = y === now.getFullYear() && m === now.getMonth();
    const end = isCurrent
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      : new Date(y, m + 1, 0, 23, 59, 59, 999);
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    const titleLong = capitalizeFirstRu(
      new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(start)
    );
    const shortRaw = new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(start);
    const labelShort = shortRaw.replace(/\.$/, "").trim();
    out.push({ key, titleLong, labelShort, start, end });
  }
  return out;
}

function monthKeyForDate(windows: MonthWindow[], date: Date): string | null {
  const t = date.getTime();
  for (const w of windows) {
    if (t >= w.start.getTime() && t <= w.end.getTime()) return w.key;
  }
  return null;
}

type ThreeMonthTxRow = {
  type: string;
  amount: number;
  currency: string;
  date: Date;
  categoryId: string | null;
  category: { name: string } | null;
};

/** Текстовый снимок для подстановки в system prompt (русский). */
export async function buildFinancialContextForAi(): Promise<string> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const threeMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
  const threeMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

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
    linkedIncomeMonth,
    linkedSubMonth,
    linkedPlannedMonth,
    txThreeMonthForAi,
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
        type: "income",
        recurringIncomeId: { not: null },
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { recurringIncomeId: true },
    }),
    prisma.transaction.findMany({
      where: {
        type: "expense",
        subscriptionId: { not: null },
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { subscriptionId: true },
    }),
    prisma.transaction.findMany({
      where: {
        type: "expense",
        plannedExpenseId: { not: null },
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { plannedExpenseId: true },
    }),
    prisma.transaction.findMany({
      where: {
        date: { gte: threeMonthStart, lte: threeMonthEnd },
        type: { in: ["income", "expense"] },
      },
      select: {
        type: true,
        amount: true,
        currency: true,
        date: true,
        categoryId: true,
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

  // ─── A) Капитал и хранилища ───────────────────────────────────────────────
  lines.push("=== A) КАПИТАЛ И ХРАНИЛИЩА ===");
  lines.push(
    `Чистый капитал по учёту приложения (только хранилища с «включить в капитал»): ${formatCurrency(dashboard.totalNetWorth, baseCurrency)}.`
  );
  lines.push("По каждому активному хранилищу:");
  for (const v of vaultSummaries) {
    const typeLabel = VAULT_TYPE_LABELS[v.type as VaultType] ?? v.type;
    lines.push(
      `  — «${v.name}» (${typeLabel}): баланс ${formatCurrency(v.balance, v.balanceCurrency)} ≈ ${formatCurrency(v.balanceInBaseCurrency, baseCurrency)} в базовой валюте`
    );
  }
  if (vaultSummaries.length === 0) {
    lines.push("  (нет активных хранилищ)");
  }

  const bucketTotals: Record<ReturnType<typeof vaultAggregateBucket>, number> = {
    bank: 0,
    crypto: 0,
    investments: 0,
    cash: 0,
    other: 0,
  };
  for (const v of vaultSummaries) {
    bucketTotals[vaultAggregateBucket(v.type)] += v.balanceInBaseCurrency;
  }
  lines.push("Разбивка суммы балансов по активным хранилищам (в базовой валюте, по типам):");
  (Object.keys(bucketTotals) as Array<keyof typeof bucketTotals>).forEach((k) => {
    lines.push(`  — ${BUCKET_LABEL[k]}: ${formatCurrency(bucketTotals[k], baseCurrency)}`);
  });
  lines.push("");

  // ─── B) Денежный поток ────────────────────────────────────────────────────
  lines.push("=== B) ДЕНЕЖНЫЙ ПОТОК (регулярные доходы и подписки) ===");
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

  lines.push("Активные подписки (Subscription):");
  let subscriptionsMonthlyBase = 0;
  for (const s of subscriptions) {
    const factor = monthlyFactorSubscription(s.billingPeriod);
    const monthlyNative = s.amount * factor;
    const monthlyBase = convertAmount(monthlyNative, s.currency, baseCurrency, rates);
    subscriptionsMonthlyBase += monthlyBase;
    const period = SUBSCRIPTION_PERIOD_RU[s.billingPeriod] ?? s.billingPeriod;
    lines.push(
      `  — «${s.name}»: ${formatCurrency(s.amount, s.currency)} (${period}), следующее списание: ${formatDate(s.nextChargeDate)}; в пересчёте на месяц ≈ ${formatCurrency(monthlyBase, baseCurrency)}`
    );
  }
  if (subscriptions.length === 0) {
    lines.push("  (нет активных подписок)");
  }
  lines.push(
    `Итого расходы по подпискам в месяц (в ${baseCurrency}): ${formatCurrency(subscriptionsMonthlyBase, baseCurrency)}.`
  );

  const freeCashFlow = recurringTotals.totalMonthly - subscriptionsMonthlyBase;
  lines.push(
    `Свободный денежный поток (регулярные доходы за месяц минус подписки за месяц, в ${baseCurrency}): ${formatCurrency(freeCashFlow, baseCurrency)}.`
  );
  lines.push("");

  const distinctRecurringThisMonth = new Set(
    linkedIncomeMonth
      .map((t) => t.recurringIncomeId)
      .filter((id): id is string => id != null)
  );
  const distinctSubThisMonth = new Set(
    linkedSubMonth.map((t) => t.subscriptionId).filter((id): id is string => id != null)
  );
  lines.push(
    "Факт по транзакциям в текущем месяце (привязка recurringIncomeId / subscriptionId):"
  );
  for (const r of recurringIncomes) {
    const received = distinctRecurringThisMonth.has(r.id);
    lines.push(
      `  — «${r.name}»: есть транзакция-доход с привязкой к этой записи в текущем месяце: ${received ? "да" : "нет"}`
    );
  }
  for (const s of subscriptions) {
    const paid = distinctSubThisMonth.has(s.id);
    lines.push(
      `  — подписка «${s.name}»: есть транзакция-расход с привязкой к этой записи в текущем месяце: ${paid ? "да" : "нет"}`
    );
  }
  lines.push(
    `Итог: ожидается доходов по справочнику (активные RecurringIncome): ${recurringIncomes.length}, подтверждено транзакциями с привязкой в этом месяце (уникальных записей): ${distinctRecurringThisMonth.size}.`
  );
  lines.push(
    `Итог: ожидается подписок по справочнику (активные Subscription): ${subscriptions.length}, подтверждено транзакциями с привязкой в этом месяце (уникальных записей): ${distinctSubThisMonth.size}.`
  );
  lines.push("");

  // ─── C) Обязательства ───────────────────────────────────────────────────────
  lines.push("=== C) ОБЯЗАТЕЛЬСТВА (долги и кредиты) ===");
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

  // ─── D) Цели ──────────────────────────────────────────────────────────────
  lines.push("=== D) ЦЕЛИ ===");
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

  // ─── E) Запланированные платежи ───────────────────────────────────────────
  lines.push("=== E) ЗАПЛАНИРОВАННЫЕ ПЛАТЕЖИ (неоплаченные) ===");
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

  // ─── H) Расходы по категориям (3 месяца) + I) доходы/расходы по месяцам + J) время и СДП ───
  const windows = buildThreeMonthWindows(now);
  const tx3: ThreeMonthTxRow[] = txThreeMonthForAi.map((t) => ({
    type: t.type,
    amount: t.amount,
    currency: t.currency,
    date: t.date,
    categoryId: t.categoryId,
    category: t.category,
  }));

  lines.push("=== H) РАСХОДЫ ПО КАТЕГОРИЯМ (последние 3 месяца) ===");
  type CatAgg = { name: string; sums: Record<string, number> };
  const catMap = new Map<string, CatAgg>();
  let uncategorizedExpenseCount = 0;
  let uncategorizedExpenseSumBase = 0;

  for (const row of tx3) {
    if (row.type !== "expense") continue;
    const mk = monthKeyForDate(windows, row.date);
    if (!mk) continue;
    const inBase = convertAmount(row.amount, row.currency, baseCurrency, rates);
    if (row.categoryId == null) {
      uncategorizedExpenseCount += 1;
      uncategorizedExpenseSumBase += inBase;
    }
    const ck = row.categoryId ?? "__uncategorized__";
    const nm = row.category?.name ?? "Без категории";
    const cur = catMap.get(ck) ?? { name: nm, sums: {} };
    if (row.categoryId != null) cur.name = nm;
    cur.sums[mk] = (cur.sums[mk] ?? 0) + inBase;
    catMap.set(ck, cur);
  }

  const rankedCats = [...catMap.entries()]
    .map(([id, v]) => {
      let total = 0;
      for (const w of windows) {
        total += v.sums[w.key] ?? 0;
      }
      return { id, name: v.name, sums: v.sums, total };
    })
    .sort((a, b) => b.total - a.total);

  if (rankedCats.length === 0) {
    lines.push("Нет расходных транзакций за последние 3 календарных месяца.");
  } else {
    lines.push("По категориям (суммы в базовой валюте по месяцам):");
    for (const row of rankedCats.slice(0, 10)) {
      const parts = windows.map((w) => {
        const v = row.sums[w.key] ?? 0;
        return `${w.labelShort} ${formatCurrency(v, baseCurrency)}`;
      });
      const first = row.sums[windows[0].key] ?? 0;
      const last = row.sums[windows[windows.length - 1].key] ?? 0;
      let trend = "";
      if (first > 0) {
        const pct = ((last - first) / first) * 100;
        trend =
          Math.abs(pct) < 0.05
            ? ""
            : ` (${pct >= 0 ? "рост" : "снижение"} ${formatPercent(pct)})`;
      } else if (first <= 0 && last > 0) {
        trend = " (рост с нуля)";
      }
      lines.push(`  — ${row.name}: ${parts.join(", ")}${trend}`);
    }
  }
  lines.push(
    `Без категории (расходы без categoryId за период): ${uncategorizedExpenseCount} транзакций на сумму ${formatCurrency(uncategorizedExpenseSumBase, baseCurrency)}.`
  );
  lines.push("");

  lines.push("=== I) ДОХОДЫ И РАСХОДЫ ПО МЕСЯЦАМ (транзакции, базовая валюта) ===");
  const incByMonth: Record<string, number> = {};
  const expByMonth: Record<string, number> = {};
  for (const w of windows) {
    incByMonth[w.key] = 0;
    expByMonth[w.key] = 0;
  }
  for (const row of tx3) {
    const mk = monthKeyForDate(windows, row.date);
    if (!mk) continue;
    const v = convertAmount(row.amount, row.currency, baseCurrency, rates);
    if (row.type === "income") incByMonth[mk] = (incByMonth[mk] ?? 0) + v;
    if (row.type === "expense") expByMonth[mk] = (expByMonth[mk] ?? 0) + v;
  }
  for (const w of windows) {
    const inc = incByMonth[w.key] ?? 0;
    const exp = expByMonth[w.key] ?? 0;
    const saved = inc - exp;
    const ratePct = inc > 0 ? (saved / inc) * 100 : null;
    lines.push(
      `${w.titleLong}: доход ${formatCurrency(inc, baseCurrency)}, расход ${formatCurrency(exp, baseCurrency)}, сохранено ${formatCurrency(saved, baseCurrency)}${
        ratePct != null && Number.isFinite(ratePct)
          ? ` (${ratePct.toFixed(1)}%)`
          : " (норма сбережений не определена — нет доходов в месяце)"
      }.`
    );
  }
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

  // ─── F) Активы ──────────────────────────────────────────────────────────────
  lines.push("=== F) АКТИВЫ (инвестиции и прочее внутри хранилищ) ===");
  let portfolioBase = 0;
  for (const a of assets) {
    const valNative = assetDisplayValue(a);
    const valBase = convertAmount(valNative, a.currency, baseCurrency, rates);
    portfolioBase += valBase;
    const typeLabel = ASSET_TYPE_LABELS[a.assetType as AssetType] ?? a.assetType;
    const qtyDecimals = Number.isInteger(a.quantity) ? 0 : 4;
    lines.push(
      `  — «${a.name}» (${typeLabel}), хранилище «${a.vault.name}»: количество ${formatNumber(a.quantity, qtyDecimals)} ${a.unit}, текущая стоимость ${formatCurrency(valNative, a.currency)} (≈ ${formatCurrency(valBase, baseCurrency)})`
    );
  }
  if (assets.length === 0) {
    lines.push("  (активных активов нет)");
  }
  lines.push(
    `Итого оценка стоимости активного портфеля активов (сумма в ${baseCurrency}): ${formatCurrency(portfolioBase, baseCurrency)}.`
  );
  lines.push("");

  // ─── G) Транзакционная аналитика 90 дней ───────────────────────────────────
  lines.push("=== G) ТРАНЗАКЦИОННАЯ АНАЛИТИКА (последние 90 дней) ===");
  if (topExpense90.length === 0) {
    lines.push("Топ-5 категорий расходов: нет расходных операций за период.");
  } else {
    lines.push("Топ-5 категорий расходов с суммами (в базовой валюте):");
    topExpense90.forEach((c, i) => {
      lines.push(`  ${i + 1}. ${c.name}: ${formatCurrency(c.totalInBase, baseCurrency)}`);
    });
  }
  const avgIncome = tx90.incomeBase / 3;
  const avgExpense = tx90.expenseBase / 3;
  lines.push(
    `Среднемесячный доход по транзакциям за 90 дней (≈ сумма за 90 дней / 3): ${formatCurrency(avgIncome, baseCurrency)}.`
  );
  lines.push(
    `Среднемесячный расход по транзакциям за 90 дней (≈ сумма за 90 дней / 3): ${formatCurrency(avgExpense, baseCurrency)}.`
  );
  const savingsRate =
    tx90.incomeBase > 0 ? ((tx90.incomeBase - tx90.expenseBase) / tx90.incomeBase) * 100 : null;
  lines.push(
    `Норма сбережений за период (доходы − расходы) / доходы × 100%: ${savingsRate != null && Number.isFinite(savingsRate) ? `${savingsRate.toFixed(1)}%` : "не определена (нет доходов по транзакциям)"}.`
  );

  return lines.join("\n");
}
