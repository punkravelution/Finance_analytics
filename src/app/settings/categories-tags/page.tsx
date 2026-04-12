import Link from "next/link";
import { Tags } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ClassifiersSettingsClient } from "@/components/settings/ClassifiersSettingsClient";

export const dynamic = "force-dynamic";

export default async function CategoriesTagsSettingsPage() {
  const [categories, tagPresets] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      include: { _count: { select: { transactions: true } } },
    }),
    prisma.tagPreset.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const categoryRows = categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    color: c.color,
    icon: c.icon,
    transactionCount: c._count.transactions,
  }));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-7">
        <Link
          href="/settings"
          className="text-sm text-slate-500 hover:text-blue-400 transition-colors mb-3 inline-block"
        >
          ← Настройки
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Tags size={22} className="text-cyan-400" />
          Категории и теги
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Справочники для операций: категории в базе данных, теги — быстрый выбор (на операции по-прежнему
          можно добавить любой текст).
        </p>
      </div>

      <ClassifiersSettingsClient categories={categoryRows} tagPresets={tagPresets} />
    </div>
  );
}
