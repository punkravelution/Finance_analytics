import { prisma } from "@/lib/prisma";
import { getBaseCurrency, getExchangeRates, convertAmount } from "@/lib/currency";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type DebtPriority = "avalanche" | "snowball";
type GoalPriorityMode = "deadline" | "priority";

async function saveFinancialPlan(formData: FormData): Promise<void> {
  "use server";
  const targetSavingsRaw = Number.parseFloat(formData.get("targetSavingsPct")?.toString() ?? "20");
  const targetSavingsPct = Number.isFinite(targetSavingsRaw)
    ? Math.min(80, Math.max(0, targetSavingsRaw))
    : 20;
  const debtPriority = (formData.get("debtPriority")?.toString() ?? "avalanche") as DebtPriority;
  const goalPriority = (formData.get("goalPriority")?.toString() ?? "deadline") as GoalPriorityMode;

  await prisma.$transaction([
    prisma.appSettings.upsert({
      where: { key: "financialPlan.targetSavingsPct" },
      update: { value: String(targetSavingsPct) },
      create: { key: "financialPlan.targetSavingsPct", value: String(targetSavingsPct) },
    }),
    prisma.appSettings.upsert({
      where: { key: "financialPlan.debtPriority" },
      update: { value: debtPriority },
      create: { key: "financialPlan.debtPriority", value: debtPriority },
    }),
    prisma.appSettings.upsert({
      where: { key: "financialPlan.goalPriority" },
      update: { value: goalPriority },
      create: { key: "financialPlan.goalPriority", value: goalPriority },
    }),
  ]);

  revalidatePath("/financial-plan");
  redirect("/financial-plan");
}

export default async function FinancialPlanPage() {
  const [baseCurrency, rates, settings, recurring, subscriptions, liabilities, goals] =
    await Promise.all([
      getBaseCurrency(),
      getExchangeRates(),
      prisma.appSettings.findMany({
        where: {
          key: {
            in: [
              "financialPlan.targetSavingsPct",
              "financialPlan.debtPriority",
              "financialPlan.goalPriority",
            ],
          },
        },
      }),
      prisma.recurringIncome.findMany({
        where: { isActive: true },
        select: { amount: true, currency: true, billingPeriod: true },
      }),
      prisma.subscription.findMany({
        where: { isActive: true },
        select: { amount: true, currency: true, billingPeriod: true, name: true },
      }),
      prisma.liability.findMany({
        where: { isActive: true, currentBalance: { gt: 0 } },
        select: { name: true, currentBalance: true, currency: true, interestRate: true, minimumPayment: true },
      }),
      prisma.goal.findMany({
        where: { isCompleted: false },
        select: { name: true, targetAmount: true, currentAmount: true, currency: true, targetDate: true, priority: true },
      }),
    ]);

  const settingMap = new Map(settings.map((s) => [s.key, s.value]));
  const targetSavingsPct = Number.parseFloat(settingMap.get("financialPlan.targetSavingsPct") ?? "20");
  const debtPriority = (settingMap.get("financialPlan.debtPriority") ?? "avalanche") as DebtPriority;
  const goalPriority = (settingMap.get("financialPlan.goalPriority") ?? "deadline") as GoalPriorityMode;

  const monthlyFactor = (period: string): number => {
    if (period === "weekly") return 52 / 12;
    if (period === "biweekly") return 26 / 12;
    if (period === "quarterly") return 1 / 3;
    if (period === "yearly") return 1 / 12;
    return 1;
  };

  const monthlyIncome = recurring.reduce(
    (sum, row) => sum + convertAmount(row.amount * monthlyFactor(row.billingPeriod), row.currency, baseCurrency, rates),
    0
  );
  const monthlySubscriptions = subscriptions.reduce(
    (sum, row) => sum + convertAmount(row.amount * monthlyFactor(row.billingPeriod), row.currency, baseCurrency, rates),
    0
  );
  const monthlyDebtMin = liabilities.reduce(
    (sum, row) => sum + convertAmount(row.minimumPayment ?? 0, row.currency, baseCurrency, rates),
    0
  );
  const fcf = monthlyIncome - monthlySubscriptions - monthlyDebtMin;

  const targetSavingsAmount = (monthlyIncome * (Number.isFinite(targetSavingsPct) ? targetSavingsPct : 20)) / 100;
  const remainingAfterFixed = monthlyIncome - monthlySubscriptions - monthlyDebtMin - targetSavingsAmount;
  const distributable = Math.max(0, remainingAfterFixed);

  const debtSorted = liabilities.slice().sort((a, b) => {
    if (debtPriority === "avalanche") {
      return (b.interestRate ?? 0) - (a.interestRate ?? 0);
    }
    const aBase = convertAmount(a.currentBalance, a.currency, baseCurrency, rates);
    const bBase = convertAmount(b.currentBalance, b.currency, baseCurrency, rates);
    return aBase - bBase;
  });
  const debtTarget = debtSorted[0] ?? null;

  const goalsSorted = goals.slice().sort((a, b) => {
    if (goalPriority === "deadline") {
      const ad = a.targetDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const bd = b.targetDate?.getTime() ?? Number.POSITIVE_INFINITY;
      return ad - bd;
    }
    const p = (x: string): number => (x === "high" ? 0 : x === "medium" ? 1 : 2);
    const pa = p(a.priority);
    const pb = p(b.priority);
    if (pa !== pb) return pa - pb;
    const ad = a.targetDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const bd = b.targetDate?.getTime() ?? Number.POSITIVE_INFINITY;
    return ad - bd;
  });
  const goalTarget = goalsSorted[0] ?? null;

  const toDebt = distributable * 0.5;
  const toGoal = distributable * 0.4;
  const reserve = Math.max(0, distributable - toDebt - toGoal);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Финансовый план</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Параметры плана</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveFinancialPlan} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-sm text-slate-300">
              Целевая норма сбережений, %
              <input
                name="targetSavingsPct"
                type="number"
                min={0}
                max={80}
                step="1"
                defaultValue={Number.isFinite(targetSavingsPct) ? targetSavingsPct : 20}
                className="mt-1 w-full rounded-md border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,10%)] px-3 py-2 text-white"
              />
            </label>
            <label className="text-sm text-slate-300">
              Приоритет погашения долгов
              <select
                name="debtPriority"
                defaultValue={debtPriority}
                className="mt-1 w-full rounded-md border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,10%)] px-3 py-2 text-white"
              >
                <option value="avalanche">Лавина (высокая ставка)</option>
                <option value="snowball">Снежный ком (малый остаток)</option>
              </select>
            </label>
            <label className="text-sm text-slate-300">
              Приоритет целей
              <select
                name="goalPriority"
                defaultValue={goalPriority}
                className="mt-1 w-full rounded-md border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,10%)] px-3 py-2 text-white"
              >
                <option value="deadline">Ближайший дедлайн</option>
                <option value="priority">Высокий приоритет</option>
              </select>
            </label>
            <div className="md:col-span-3">
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Сохранить параметры
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Автоматический план распределения дохода</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>Доход/мес: <span className="font-semibold text-green-400">{formatCurrency(monthlyIncome, baseCurrency)}</span></p>
          <p>Подписки + мин. платежи: {formatCurrency(monthlySubscriptions + monthlyDebtMin, baseCurrency)}</p>
          <p>
            Целевая норма сбережений: {formatPercent(targetSavingsPct)} ({formatCurrency(targetSavingsAmount, baseCurrency)})
          </p>
          <p>
            Текущий FCF:{" "}
            <span className={fcf >= 0 ? "font-semibold text-cyan-400" : "font-semibold text-red-400"}>
              {formatCurrency(fcf, baseCurrency)}/мес
            </span>
          </p>
          <p>
            Распределение каждого рублёвого дохода:{" "}
            {debtTarget
              ? `${formatCurrency(toDebt, baseCurrency)} на ${debtTarget.name} (${debtPriority === "avalanche" ? "лавина" : "снежный ком"})`
              : `${formatCurrency(0, baseCurrency)} на долги`}
            {", "}
            {goalTarget
              ? `${formatCurrency(toGoal, baseCurrency)} на цель '${goalTarget.name}'`
              : `${formatCurrency(0, baseCurrency)} на цели`}
            {`, ${formatCurrency(reserve, baseCurrency)} в резерв`}
          </p>
          {remainingAfterFixed < 0 && (
            <p className="text-amber-300">
              Дефицит плана: {formatCurrency(Math.abs(remainingAfterFixed), baseCurrency)} — уменьшите целевую норму
              сбережений или обязательные расходы.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

