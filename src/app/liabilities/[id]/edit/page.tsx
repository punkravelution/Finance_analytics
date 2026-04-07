import { notFound } from "next/navigation";
import { HandCoins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { LiabilityForm } from "@/components/forms/LiabilityForm";
import {
  updateLiability,
  closeLiability,
  disableLiability,
} from "@/app/actions/liability";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditLiabilityPage({ params }: Props) {
  const { id } = await params;

  const [liability, currencies] = await Promise.all([
    prisma.liability.findUnique({ where: { id } }),
    prisma.currency.findMany({
      where: { isActive: true },
      select: { code: true, name: true, symbol: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
  ]);

  if (!liability) notFound();

  const action = updateLiability.bind(null, id);
  const closeAction = closeLiability.bind(null, id);
  const disableAction = disableLiability.bind(null, id);
  const dateStr = liability.nextPaymentDate
    ? liability.nextPaymentDate.toISOString().split("T")[0]
    : null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HandCoins size={22} className="text-rose-400" />
          Редактировать долг
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры долга</CardTitle>
        </CardHeader>
        <CardContent>
          <LiabilityForm
            action={action}
            currencies={currencies}
            cancelHref="/liabilities"
            submitLabel="Сохранить изменения"
            defaultValues={{
              name: liability.name,
              type: liability.type,
              principalAmount: liability.principalAmount,
              currentBalance: liability.currentBalance,
              currency: liability.currency,
              interestRate: liability.interestRate,
              minimumPayment: liability.minimumPayment,
              nextPaymentDate: dateStr,
              lender: liability.lender,
              note: liability.note,
            }}
          />
        </CardContent>
      </Card>

      <div className="mt-8 p-4 border border-amber-500/20 rounded-xl bg-amber-500/5">
        <h3 className="text-sm font-medium text-amber-300 mb-2">Управление долгом</h3>
        <div className="flex flex-wrap gap-2">
          <form action={closeAction}>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-sm font-medium"
            >
              Закрыть долг
            </button>
          </form>
          <form action={disableAction}>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-700/40 hover:bg-slate-700/60 border border-slate-500/40 text-slate-300 rounded-lg text-sm font-medium"
            >
              Отключить (без закрытия)
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
