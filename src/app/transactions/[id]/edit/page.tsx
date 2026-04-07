import { notFound } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { prisma } from "@/lib/prisma";
import { updateTransaction, deleteTransaction } from "@/app/actions/transaction";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTransactionPage({ params }: Props) {
  const { id } = await params;

  const [transaction, vaults, categories] = await Promise.all([
    prisma.transaction.findUnique({ where: { id } }),
    prisma.vault.findMany({
      where: { isActive: true },
      select: { id: true, name: true, icon: true, balanceSource: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.category.findMany({
      select: { id: true, name: true, type: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!transaction) notFound();

  const action = updateTransaction.bind(null, id);
  const deleteAction = deleteTransaction.bind(null, id);

  const dateStr = transaction.date.toISOString().split("T")[0];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ArrowLeftRight size={22} className="text-cyan-400" />
          Редактировать операцию
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры операции</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm
            action={action}
            vaults={vaults}
            categories={categories}
            cancelHref="/transactions"
            submitLabel="Сохранить изменения"
            defaultValues={{
              type: transaction.type,
              amount: transaction.amount,
              date: dateStr,
              fromVaultId: transaction.fromVaultId,
              toVaultId: transaction.toVaultId,
              categoryId: transaction.categoryId,
              note: transaction.note,
              currency: transaction.currency,
            }}
          />
        </CardContent>
      </Card>

      {/* Удаление */}
      <div className="mt-8 p-4 border border-red-500/20 rounded-xl bg-red-500/5">
        <h3 className="text-sm font-medium text-red-400 mb-2">Опасная зона</h3>
        <p className="text-xs text-slate-500 mb-3">
          Операция будет безвозвратно удалена из базы данных.
        </p>
        <form action={deleteAction}>
          <button
            type="submit"
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 rounded-lg text-sm font-medium transition-colors"
          >
            Удалить операцию
          </button>
        </form>
      </div>
    </div>
  );
}
