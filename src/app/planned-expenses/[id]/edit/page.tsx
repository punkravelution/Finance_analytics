import { notFound } from "next/navigation";
import { Edit3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { PlannedExpenseForm } from "@/components/forms/PlannedExpenseForm";
import { getPlannedExpenseById, updatePlannedExpense } from "@/app/actions/plannedExpense";
import { DeletePlannedExpenseButton } from "@/components/goals/DeletePlannedExpenseButton";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPlannedExpensePage({ params }: Props) {
  const { id } = await params;

  const [expense, vaults] = await Promise.all([
    getPlannedExpenseById(id),
    prisma.vault.findMany({
      where: { isActive: true },
      select: { id: true, name: true, currency: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!expense) notFound();

  const onSubmit = updatePlannedExpense.bind(null, id);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Edit3 size={22} className="text-cyan-400" />
          Редактировать платёж
        </h1>
        <DeletePlannedExpenseButton expenseId={id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры платежа</CardTitle>
        </CardHeader>
        <CardContent>
          <PlannedExpenseForm vaults={vaults} initialData={expense} onSubmit={onSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}
