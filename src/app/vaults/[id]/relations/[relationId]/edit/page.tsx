import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import {
  updateVaultRelation,
  deleteVaultRelation,
} from "@/app/actions/vaultRelation";
import { VaultRelationForm } from "@/components/forms/VaultRelationForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; relationId: string }>;
}

export default async function EditVaultRelationPage({ params }: Props) {
  const { id, relationId } = await params;

  const [relation, vaults] = await Promise.all([
    prisma.vaultRelation.findUnique({ where: { id: relationId } }),
    prisma.vault.findMany({
      where: { isActive: true },
      select: { id: true, name: true, icon: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!relation) notFound();

  const updateAction = updateVaultRelation.bind(null, relationId);
  const deleteAction = deleteVaultRelation.bind(null, relationId, id);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-5">
        <Link
          href={`/vaults/${id}`}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors w-fit"
        >
          <ChevronLeft size={14} />
          Назад к хранилищу
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Редактировать связь</CardTitle>
        </CardHeader>
        <CardContent>
          <VaultRelationForm
            action={updateAction}
            vaults={vaults}
            defaultValues={{
              fromVaultId: relation.fromVaultId,
              toVaultId: relation.toVaultId,
              relationType: relation.relationType,
              strength: relation.strength,
              note: relation.note ?? undefined,
            }}
            cancelHref={`/vaults/${id}`}
          />

          <div className="mt-6 pt-4 border-t border-[hsl(216,34%,17%)]">
            <form action={deleteAction}>
              <button
                type="submit"
                className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-colors"
              >
                Удалить связь
              </button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
