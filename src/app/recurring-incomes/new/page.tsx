import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { RecurringIncomeForm } from "@/components/forms/RecurringIncomeForm";
import { createRecurringIncome } from "@/app/actions/recurringIncome";

export const dynamic = "force-dynamic";

export default async function NewRecurringIncomePage() {
  const vaults = await prisma.vault.findMany({
    where: { isActive: true },
    select: { id: true, name: true, currency: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Plus size={22} className="text-green-400" />
          Новый регулярный доход
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры дохода</CardTitle>
        </CardHeader>
        <CardContent>
          <RecurringIncomeForm vaults={vaults} onSubmit={createRecurringIncome} />
        </CardContent>
      </Card>
    </div>
  );
}
