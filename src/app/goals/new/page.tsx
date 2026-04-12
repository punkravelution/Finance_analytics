import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { GoalForm } from "@/components/forms/GoalForm";
import { createGoal } from "@/app/actions/goal";

export const dynamic = "force-dynamic";

export default async function NewGoalPage() {
  const vaults = await prisma.vault.findMany({
    where: { isActive: true },
    select: { id: true, name: true, currency: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Plus size={22} className="text-blue-400" />
          Новая цель накопления
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры цели</CardTitle>
        </CardHeader>
        <CardContent>
          <GoalForm vaults={vaults} onSubmit={createGoal} />
        </CardContent>
      </Card>
    </div>
  );
}
