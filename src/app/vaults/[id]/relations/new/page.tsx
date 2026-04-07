import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { createVaultRelation } from "@/app/actions/vaultRelation";
import { VaultRelationForm } from "@/components/forms/VaultRelationForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewVaultRelationPage({ params }: Props) {
  const { id } = await params;

  const vault = await prisma.vault.findUnique({
    where: { id, isActive: true },
    select: { id: true, name: true },
  });

  if (!vault) notFound();

  const vaults = await prisma.vault.findMany({
    where: { isActive: true },
    select: { id: true, name: true, icon: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-5">
        <Link
          href={`/vaults/${id}`}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors w-fit"
        >
          <ChevronLeft size={14} />
          {vault.name}
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Новая связь</CardTitle>
        </CardHeader>
        <CardContent>
          <VaultRelationForm
            action={createVaultRelation}
            vaults={vaults}
            defaultValues={{ fromVaultId: id }}
            cancelHref={`/vaults/${id}`}
            submitLabel="Создать"
          />
        </CardContent>
      </Card>
    </div>
  );
}
