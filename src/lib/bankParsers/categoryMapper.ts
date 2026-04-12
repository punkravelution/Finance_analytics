import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Популярные категории банков → названия категорий в приложении (поиск в БД без учёта регистра).
 * null — не подставлять категорию из банка.
 */
export const BANK_CATEGORY_TO_APP_NAME: Record<string, string | null> = {
  Супермаркеты: "Продукты",
  Рестораны: "Кафе и рестораны",
  АЗС: "Топливо",
  Транспорт: "Транспорт",
  Аптеки: "Здоровье",
  Развлечения: "Развлечения",
  "Одежда и обувь": "Одежда",
  Связь: "Связь",
  "Коммунальные услуги": "Коммунальные",
  Переводы: null,
  Пополнения: null,
};

/** Если точное имя из маппинга не найдено в БД — пробуем эти варианты по очереди. */
const APP_NAME_ALIASES: Record<string, string[]> = {
  "Кафе и рестораны": ["Продукты"],
  ЖКХ: ["Коммунальные"],
};

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

export type ResolveImportedCategory = (rawCategory: string) => string | null;

/**
 * Один запрос категорий; дальше резолв в памяти (для пакетного импорта).
 */
export async function createImportedCategoryResolver(
  prisma: PrismaClient
): Promise<ResolveImportedCategory> {
  const rows = await prisma.category.findMany({ select: { id: true, name: true } });
  const byLower = new Map<string, string>();
  for (const r of rows) {
    byLower.set(normalizeName(r.name), r.id);
  }

  function findId(name: string): string | null {
    return byLower.get(normalizeName(name)) ?? null;
  }

  function findWithAliases(name: string): string | null {
    let id = findId(name);
    if (id) return id;
    const alts = APP_NAME_ALIASES[name.trim()];
    if (alts) {
      for (const alt of alts) {
        id = findId(alt);
        if (id) return id;
      }
    }
    return null;
  }

  return (rawCategory: string): string | null => {
    const trimmed = rawCategory.trim();
    if (!trimmed) return null;

    if (Object.prototype.hasOwnProperty.call(BANK_CATEGORY_TO_APP_NAME, trimmed)) {
      const mapped = BANK_CATEGORY_TO_APP_NAME[trimmed];
      if (mapped === null) return null;
      return findWithAliases(mapped);
    }

    return findWithAliases(trimmed);
  };
}
