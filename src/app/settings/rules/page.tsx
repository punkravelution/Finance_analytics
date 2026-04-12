import Link from "next/link";
import { ListFilter } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCategoryRules } from "@/app/actions/categoryRule";
import { CategoryRulesSettingsClient } from "@/components/settings/CategoryRulesSettingsClient";

export const dynamic = "force-dynamic";

export default async function CategoryRulesSettingsPage() {
  const [rules, categories] = await Promise.all([
    getCategoryRules(),
    prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = rules.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    categoryId: r.categoryId,
    priority: r.priority,
    isActive: r.isActive,
    source: r.source,
    matchCount: r.matchCount,
    category: {
      id: r.category.id,
      name: r.category.name,
      color: r.category.color,
    },
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-7">
        <Link
          href="/settings"
          className="text-sm text-slate-500 hover:text-blue-400 transition-colors mb-3 inline-block"
        >
          ← Настройки
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ListFilter size={22} className="text-cyan-400" />
          Правила категоризации
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Подстроки в описании импортируемых операций сопоставляются с категориями. При ручной смене категории в
          списке операций можно обучать новые правила (источник «обучено»).
        </p>
      </div>

      {categories.length === 0 && (
        <p className="mb-6 text-sm text-amber-200/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          В базе ещё нет категорий. Сначала добавьте категории в разделе «Категории и теги», затем возвращайтесь к
          правилам.
        </p>
      )}

      <CategoryRulesSettingsClient initialRules={rows} categories={categories} />
    </div>
  );
}
