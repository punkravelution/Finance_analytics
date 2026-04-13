import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";

function parseDate(raw: string | null, endOfDay: boolean): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function parseNumber(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function buildWhere(request: NextRequest): Prisma.TransactionWhereInput {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = request.nextUrl.searchParams.get("type")?.trim() ?? "";
  const categoryId = request.nextUrl.searchParams.get("categoryId")?.trim() ?? "";
  const vaultId = request.nextUrl.searchParams.get("vaultId")?.trim() ?? "";
  const onlyUncategorized = request.nextUrl.searchParams.get("filter") === "uncategorized";
  const dateFrom = parseDate(request.nextUrl.searchParams.get("dateFrom"), false);
  const dateTo = parseDate(request.nextUrl.searchParams.get("dateTo"), true);
  const amountMin = parseNumber(request.nextUrl.searchParams.get("amountMin"));
  const amountMax = parseNumber(request.nextUrl.searchParams.get("amountMax"));

  const and: Prisma.TransactionWhereInput[] = [];
  if (onlyUncategorized) and.push({ categoryId: null });
  if (type === "income" || type === "expense" || type === "transfer") and.push({ type });
  if (categoryId) and.push({ categoryId });
  if (vaultId) and.push({ OR: [{ fromVaultId: vaultId }, { toVaultId: vaultId }] });
  if (query) {
    and.push({
      OR: [
        { note: { contains: query, mode: "insensitive" } },
        { category: { name: { contains: query, mode: "insensitive" } } },
      ],
    });
  }
  if (dateFrom || dateTo) {
    and.push({ date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } });
  }
  if (amountMin != null || amountMax != null) {
    and.push({
      amount: { ...(amountMin != null ? { gte: amountMin } : {}), ...(amountMax != null ? { lte: amountMax } : {}) },
    });
  }
  return and.length > 0 ? { AND: and } : {};
}

function csvEscape(value: string): string {
  const normalized = value.replace(/"/g, "\"\"");
  return `"${normalized}"`;
}

export async function GET(request: NextRequest) {
  const where = buildWhere(request);
  const txs = await prisma.transaction.findMany({
    where,
    include: {
      category: { select: { name: true } },
      fromVault: { select: { name: true } },
      toVault: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 5000,
  });

  const lines = ["date,type,amount,currency,category,fromVault,toVault,note"];
  for (const tx of txs) {
    lines.push(
      [
        tx.date.toISOString(),
        tx.type,
        String(tx.amount),
        tx.currency,
        tx.category?.name ?? "",
        tx.fromVault?.name ?? "",
        tx.toVault?.name ?? "",
        tx.note ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  return new Response(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="transactions-export.csv"',
      "Cache-Control": "no-store",
    },
  });
}
