import { ArrowLeftRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { prisma } from "@/lib/prisma";
import { createTransaction } from "@/app/actions/transaction";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage() {
  const [vaults, categories] = await Promise.all([
    prisma.vault.findMany({
      where: { isActive: true },
      select: { id: true, name: true, icon: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.category.findMany({
      select: { id: true, name: true, type: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ArrowLeftRight size={22} className="text-cyan-400" />
          Новая операция
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры операции</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm
            action={createTransaction}
            vaults={vaults}
            categories={categories}
            cancelHref="/transactions"
            submitLabel="Добавить операцию"
          />
        </CardContent>
      </Card>
    </div>
  );
}
