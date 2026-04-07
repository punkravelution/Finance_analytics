import { notFound } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { SubscriptionForm } from "@/components/forms/SubscriptionForm";
import {
  updateSubscription,
  disableSubscription,
  deleteSubscription,
} from "@/app/actions/subscription";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditSubscriptionPage({ params }: Props) {
  const { id } = await params;

  const [subscription, vaults, currencies] = await Promise.all([
    prisma.subscription.findUnique({ where: { id } }),
    prisma.vault.findMany({
      where: { isActive: true },
      select: { id: true, name: true, icon: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.currency.findMany({
      where: { isActive: true },
      select: { code: true, name: true, symbol: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
  ]);

  if (!subscription) notFound();

  const action = updateSubscription.bind(null, id);
  const disableAction = disableSubscription.bind(null, id);
  const deleteAction = deleteSubscription.bind(null, id);

  const dateStr = subscription.nextChargeDate.toISOString().split("T")[0];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <RefreshCcw size={22} className="text-cyan-400" />
          Редактировать подписку
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры подписки</CardTitle>
        </CardHeader>
        <CardContent>
          <SubscriptionForm
            action={action}
            vaults={vaults}
            currencies={currencies}
            cancelHref="/subscriptions"
            submitLabel="Сохранить изменения"
            defaultValues={{
              name: subscription.name,
              amount: subscription.amount,
              currency: subscription.currency,
              billingPeriod: subscription.billingPeriod,
              nextChargeDate: dateStr,
              category: subscription.category,
              vaultId: subscription.vaultId,
              isEssential: subscription.isEssential,
              note: subscription.note,
            }}
          />
        </CardContent>
      </Card>

      <div className="mt-8 p-4 border border-amber-500/20 rounded-xl bg-amber-500/5">
        <h3 className="text-sm font-medium text-amber-300 mb-2">Управление подпиской</h3>
        <div className="flex flex-wrap gap-2">
          <form action={disableAction}>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-700/40 hover:bg-slate-700/60 border border-slate-500/40 text-slate-300 rounded-lg text-sm font-medium"
            >
              Отключить подписку
            </button>
          </form>
          <form action={deleteAction}>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 rounded-lg text-sm font-medium"
            >
              Удалить подписку
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
