import { prisma } from "@/lib/prisma";
import { BankImportForm } from "@/components/import/BankImportForm";

export const dynamic = "force-dynamic";

export default async function ImportBankPage() {
  const vaults = await prisma.vault.findMany({
    where: { isActive: true, balanceSource: "MANUAL" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Импорт выписки</h1>
      <p className="text-sm text-slate-500 mb-6">
        Загрузите CSV из Сбербанка или Т-Банка. Подключения к банкам нет — только разбор файла.
      </p>
      <BankImportForm vaults={vaults} />
    </div>
  );
}
