import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { PlannedExpenseForm } from "@/components/forms/PlannedExpenseForm";
import { createPlannedExpense } from "@/app/actions/plannedExpense";

export const dynamic = "force-dynamic";

export default async function NewPlannedExpensePage() {
  const vaults = await prisma.vault.findMany({
    where: { isActive: true },
    select: { id: true, name: true, currency: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Plus size={22} className="text-orange-400" />
          Новый запланированный платёж
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры платежа</CardTitle>
        </CardHeader>
        <CardContent>
          <PlannedExpenseForm vaults={vaults} onSubmit={createPlannedExpense} />
        </CardContent>
      </Card>
    </div>
  );
}
