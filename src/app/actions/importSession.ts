"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ImportSessionListItem = Awaited<ReturnType<typeof getImportSessions>>[number];

/** Данные для клиентского компонента (даты после сериализации — строки ISO). */
export type ImportSessionListItemSerialized = Omit<
  ImportSessionListItem,
  "dateFrom" | "dateTo" | "createdAt"
> & {
  dateFrom: string;
  dateTo: string;
  createdAt: string;
};

export async function getImportSessions() {
  return prisma.importSession.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      vault: { select: { id: true, name: true } },
    },
  });
}

export async function deleteImportSession(
  id: string
): Promise<{ ok: true; deletedCount: number } | { ok: false; error: string }> {
  try {
    const deletedCount = await prisma.transaction.count({
      where: { importSessionId: id },
    });
    await prisma.importSession.delete({ where: { id } });
    revalidatePath("/transactions");
    revalidatePath("/import");
    revalidatePath("/vaults");
    revalidatePath("/");
    return { ok: true, deletedCount };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка удаления" };
  }
}
