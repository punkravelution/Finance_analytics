import { notFound } from "next/navigation";
import { Edit3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { GoalForm } from "@/components/forms/GoalForm";
import { getGoalById, updateGoal } from "@/app/actions/goal";
import { DeleteGoalButton } from "@/components/goals/DeleteGoalButton";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditGoalPage({ params }: Props) {
  const { id } = await params;

  const [goal, vaults] = await Promise.all([
    getGoalById(id),
    prisma.vault.findMany({
      where: { isActive: true },
      select: { id: true, name: true, currency: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!goal) notFound();

  const onSubmit = updateGoal.bind(null, id);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Edit3 size={22} className="text-cyan-400" />
          Редактировать цель
        </h1>
        <DeleteGoalButton goalId={id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры цели</CardTitle>
        </CardHeader>
        <CardContent>
          <GoalForm vaults={vaults} initialData={goal} onSubmit={onSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}
