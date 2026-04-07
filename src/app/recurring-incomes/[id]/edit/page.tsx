import { notFound } from "next/navigation";
import { Edit3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { RecurringIncomeForm } from "@/components/forms/RecurringIncomeForm";
import { getRecurringIncomeById, updateRecurringIncome } from "@/app/actions/recurringIncome";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditRecurringIncomePage({ params }: Props) {
  const { id } = await params;

  const [income, vaults] = await Promise.all([
    getRecurringIncomeById(id),
    prisma.vault.findMany({
      where: { isActive: true },
      select: { id: true, name: true, currency: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!income) notFound();

  const onSubmit = updateRecurringIncome.bind(null, id);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Edit3 size={22} className="text-cyan-400" />
          Редактировать регулярный доход
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры дохода</CardTitle>
        </CardHeader>
        <CardContent>
          <RecurringIncomeForm vaults={vaults} initialData={income} onSubmit={onSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}
