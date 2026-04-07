import { notFound } from "next/navigation";
import { Vault } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VaultForm } from "@/components/forms/VaultForm";
import { prisma } from "@/lib/prisma";
import { updateVault, deleteVault } from "@/app/actions/vault";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditVaultPage({ params }: Props) {
  const { id } = await params;

  const vault = await prisma.vault.findUnique({ where: { id } });
  if (!vault || !vault.isActive) notFound();

  const action = updateVault.bind(null, id);
  const deleteAction = deleteVault.bind(null, id);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Vault size={22} className="text-blue-400" />
          Редактировать хранилище
        </h1>
        <p className="text-sm text-slate-500 mt-1">{vault.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры хранилища</CardTitle>
        </CardHeader>
        <CardContent>
          <VaultForm
            action={action}
            cancelHref={`/vaults/${id}`}
            submitLabel="Сохранить изменения"
            defaultValues={{
              name: vault.name,
              type: vault.type,
              currency: vault.currency,
              liquidityLevel: vault.liquidityLevel,
              riskLevel: vault.riskLevel,
              includeInNetWorth: vault.includeInNetWorth,
              includeInSpendableBalance: vault.includeInSpendableBalance,
              includeInLiquidCapital: vault.includeInLiquidCapital,
              notes: vault.notes ?? undefined,
            }}
          />
        </CardContent>
      </Card>

      {/* Удаление */}
      <div className="mt-8 p-4 border border-red-500/20 rounded-xl bg-red-500/5">
        <h3 className="text-sm font-medium text-red-400 mb-2">Опасная зона</h3>
        <p className="text-xs text-slate-500 mb-3">
          Хранилище будет скрыто из интерфейса (не удалено из базы данных).
        </p>
        <form action={deleteAction}>
          <button
            type="submit"
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 rounded-lg text-sm font-medium transition-colors"
          >
            Деактивировать хранилище
          </button>
        </form>
      </div>
    </div>
  );
}
