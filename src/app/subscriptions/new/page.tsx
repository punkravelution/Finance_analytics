import { RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getActiveCurrenciesWithDefaults } from "@/lib/currencyDirectory";
import { SubscriptionForm } from "@/components/forms/SubscriptionForm";
import { createSubscription } from "@/app/actions/subscription";

export const dynamic = "force-dynamic";

export default async function NewSubscriptionPage() {
  const [vaults, currencies] = await Promise.all([
    prisma.vault.findMany({
      where: { isActive: true },
      select: { id: true, name: true, icon: true },
      orderBy: { sortOrder: "asc" },
    }),
    getActiveCurrenciesWithDefaults(),
  ]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <RefreshCcw size={22} className="text-cyan-400" />
          Новая подписка
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры подписки</CardTitle>
        </CardHeader>
        <CardContent>
          <SubscriptionForm
            action={createSubscription}
            vaults={vaults}
            currencies={currencies}
            cancelHref="/subscriptions"
            submitLabel="Добавить подписку"
          />
        </CardContent>
      </Card>
    </div>
  );
}
