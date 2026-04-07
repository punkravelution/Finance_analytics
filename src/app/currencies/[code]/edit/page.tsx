import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyEditForm } from "@/components/currencies/CurrencyEditForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function EditCurrencyPage({ params }: Props) {
  const { code } = await params;
  const currency = await prisma.currency.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!currency) notFound();

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-5">
        <Link
          href="/currencies"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors w-fit"
        >
          <ChevronLeft size={14} />
          Назад к валютам
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Редактировать валюту</CardTitle>
        </CardHeader>
        <CardContent>
          <CurrencyEditForm currency={currency} />
        </CardContent>
      </Card>
    </div>
  );
}
