import { HandCoins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { LiabilityForm } from "@/components/forms/LiabilityForm";
import { createLiability } from "@/app/actions/liability";

export const dynamic = "force-dynamic";

export default async function NewLiabilityPage() {
  const currencies = await prisma.currency.findMany({
    where: { isActive: true },
    select: { code: true, name: true, symbol: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HandCoins size={22} className="text-rose-400" />
          Новый долг
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры долга</CardTitle>
        </CardHeader>
        <CardContent>
          <LiabilityForm
            action={createLiability}
            currencies={currencies}
            cancelHref="/liabilities"
            submitLabel="Добавить долг"
          />
        </CardContent>
      </Card>
    </div>
  );
}
