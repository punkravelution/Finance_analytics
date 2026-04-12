import { prisma } from "@/lib/prisma";
import { getImportSessions } from "@/app/actions/importSession";
import { BankImportForm } from "@/components/import/BankImportForm";
import { ImportHistory } from "@/components/import/ImportHistory";

export const dynamic = "force-dynamic";

export default async function ImportBankPage() {
  const [vaults, importSessions] = await Promise.all([
    prisma.vault.findMany({
      where: { isActive: true, balanceSource: "MANUAL" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    getImportSessions(),
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Импорт выписки</h1>
        <p className="text-sm text-slate-500 mb-6">
          Загрузите CSV из Сбербанка или Т-Банка. Подключения к банкам нет — только разбор файла.
        </p>
        <BankImportForm vaults={vaults} />
      </div>
      <ImportHistory
        sessions={importSessions.map((s) => ({
          ...s,
          dateFrom: s.dateFrom.toISOString(),
          dateTo: s.dateTo.toISOString(),
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
