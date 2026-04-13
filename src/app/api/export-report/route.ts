import { prisma } from "@/lib/prisma";
import { convertAmount, getBaseCurrency, getExchangeRates } from "@/lib/currency";
import { getVaultBalance } from "@/lib/vaultBalance";

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

function daysUntil(dueDate: Date, today: Date): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const end = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
  return Math.ceil((end - start) / 86400000);
}

export async function GET(): Promise<Response> {
  const now = new Date();
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
      const table = rows
        .map((tx) => {
          const type = tx.type as TxType;
          const baseDescription = type === "transfer" ? "Перевод" : "Операция";
          const note = tx.note?.trim();
          const description = note ? `${baseDescription} (${note})` : baseDescription;
          const categoryName = tx.category?.name ?? "[без категории]";
          const vaultName =
            type === "transfer"
              ? `${tx.fromVault?.name ?? "—"} → ${tx.toVault?.name ?? "—"}`
              : tx.toVault?.name ?? tx.fromVault?.name ?? "—";
          return `| ${formatDateShort(tx.date)} | ${txTypeLabel(type)} | ${description} | ${categoryName} | ${txSignedAmount(type, tx.amount, tx.currency)} | ${vaultName} |`;
        })
        .join("\n");

      return `### ${title}

| Дата | Тип | Описание | Категория | Сумма | Хранилище |
|------|-----|----------|-----------|-------|-----------|
${table}`;
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
