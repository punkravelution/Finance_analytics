import type { PrismaClient } from "@/generated/prisma/client";

/** Описание стандартного правила: паттерн (будет нормализован в ВЕРХНИЙ регистр) и имя категории в БД. */
export type DefaultCategoryRuleDef = {
  pattern: string;
  categoryName: string;
  priority: number;
};

/** Подстроки в описании (верхний регистр): не подставлять авто-категорию (переводы с банковских счетов). */
export const BANK_AUTO_CATEGORY_EXCLUSIONS: readonly string[] = [
  "SBERBANK",
  "СБЕРБАНК",
  "TINKOFF",
  "T-BANK",
  "ТИНЬКОФФ",
  "Т БАНК",
];

const CATEGORY_COLORS: Record<string, string> = {
  Такси: "#eab308",
  Транспорт: "#f97316",
  Фастфуд: "#f43f5e",
  "Доставка еды": "#fb923c",
  Продукты: "#ef4444",
  "Кафе и рестораны": "#c084fc",
  Подписки: "#6366f1",
  Игры: "#8b5cf6",
  Здоровье: "#ec4899",
  Связь: "#0ea5e9",
  ЖКХ: "#64748b",
};

function colorForCategory(name: string): string {
  return CATEGORY_COLORS[name.trim()] ?? "#64748b";
}

/** Паттерны для популярных российских сервисов (импорт / кнопка «стандартные правила»). */
export const DEFAULT_CATEGORY_RULE_DEFINITIONS: readonly DefaultCategoryRuleDef[] = [
  // Такси и транспорт
  { pattern: "YANDEX*TAXI", categoryName: "Такси", priority: 80 },
  { pattern: "YANDEX*FASTEN", categoryName: "Такси", priority: 80 },
  { pattern: "UBER", categoryName: "Такси", priority: 75 },
  { pattern: "CITYMOBIL", categoryName: "Такси", priority: 75 },
  { pattern: "METRO", categoryName: "Транспорт", priority: 70 },
  { pattern: "МЕТРО", categoryName: "Транспорт", priority: 70 },
  { pattern: "MTA", categoryName: "Транспорт", priority: 65 },
  { pattern: "АЭРОЭКСПРЕСС", categoryName: "Транспорт", priority: 70 },
  { pattern: "RZHDBONUS", categoryName: "Транспорт", priority: 65 },
  { pattern: "RZD", categoryName: "Транспорт", priority: 65 },
  { pattern: "TUTU", categoryName: "Транспорт", priority: 65 },
  { pattern: "ТУTU", categoryName: "Транспорт", priority: 65 },
  // Еда и рестораны
  { pattern: "MCDONALDS", categoryName: "Фастфуд", priority: 55 },
  { pattern: "MCDONALD", categoryName: "Фастфуд", priority: 55 },
  { pattern: "KFC", categoryName: "Фастфуд", priority: 55 },
  { pattern: "BURGER KING", categoryName: "Фастфуд", priority: 55 },
  { pattern: "BURGERKING", categoryName: "Фастфуд", priority: 55 },
  { pattern: "DELIVERY CLUB", categoryName: "Доставка еды", priority: 60 },
  { pattern: "DELIVERYCLUB", categoryName: "Доставка еды", priority: 60 },
  { pattern: "ЯНДЕКС.ЕДА", categoryName: "Доставка еды", priority: 60 },
  { pattern: "YANDEX*EDA", categoryName: "Доставка еды", priority: 60 },
  { pattern: "PEREKRESTOK", categoryName: "Продукты", priority: 50 },
  { pattern: "ПЯТЁРОЧКА", categoryName: "Продукты", priority: 50 },
  { pattern: "PYATEROCHKA", categoryName: "Продукты", priority: 50 },
  { pattern: "MAGNIT", categoryName: "Продукты", priority: 50 },
  { pattern: "МАГНИТ", categoryName: "Продукты", priority: 50 },
  { pattern: "VKUSVILL", categoryName: "Продукты", priority: 50 },
  { pattern: "ВКУСВИЛЛ", categoryName: "Продукты", priority: 50 },
  { pattern: "LENTA", categoryName: "Продукты", priority: 50 },
  { pattern: "ЛЕНТА", categoryName: "Продукты", priority: 50 },
  { pattern: "AUCHAN", categoryName: "Продукты", priority: 50 },
  { pattern: "ОШЕ", categoryName: "Продукты", priority: 50 },
  { pattern: "TABRIS", categoryName: "Продукты", priority: 48 },
  { pattern: "KRASNOE", categoryName: "Продукты", priority: 48 },
  { pattern: "КРАСНОЕ", categoryName: "Продукты", priority: 48 },
  // Кафе
  { pattern: "STARBUCKS", categoryName: "Кафе и рестораны", priority: 52 },
  { pattern: "COFFEE", categoryName: "Кафе и рестораны", priority: 45 },
  { pattern: "КОФЕ", categoryName: "Кафе и рестораны", priority: 45 },
  { pattern: "SHOKOLADNITSA", categoryName: "Кафе и рестораны", priority: 52 },
  { pattern: "ШОКОЛАДНИЦА", categoryName: "Кафе и рестораны", priority: 52 },
  { pattern: "SUSHISHOP", categoryName: "Кафе и рестораны", priority: 52 },
  { pattern: "СУШИ", categoryName: "Кафе и рестораны", priority: 48 },
  { pattern: "SUSHI", categoryName: "Кафе и рестораны", priority: 48 },
  { pattern: "PIZZA", categoryName: "Кафе и рестораны", priority: 48 },
  { pattern: "ПИЦЦА", categoryName: "Кафе и рестораны", priority: 48 },
  { pattern: "DODO", categoryName: "Кафе и рестораны", priority: 50 },
  // Онлайн-сервисы
  { pattern: "YANDEX*PLUS", categoryName: "Подписки", priority: 58 },
  { pattern: "YANDEXPLUS", categoryName: "Подписки", priority: 58 },
  { pattern: "NETFLIX", categoryName: "Подписки", priority: 58 },
  { pattern: "SPOTIFY", categoryName: "Подписки", priority: 58 },
  { pattern: "APPLE.COM", categoryName: "Подписки", priority: 58 },
  { pattern: "APPSTORE", categoryName: "Подписки", priority: 58 },
  { pattern: "STEAM", categoryName: "Игры", priority: 55 },
  { pattern: "VALVE", categoryName: "Игры", priority: 55 },
  // Здоровье
  { pattern: "APTEKA", categoryName: "Здоровье", priority: 62 },
  { pattern: "АПТЕКА", categoryName: "Здоровье", priority: 62 },
  { pattern: "PHARMACY", categoryName: "Здоровье", priority: 60 },
  { pattern: "RIGLA", categoryName: "Здоровье", priority: 58 },
  { pattern: "РИГЛА", categoryName: "Здоровье", priority: 58 },
  { pattern: "INVITRO", categoryName: "Здоровье", priority: 60 },
  { pattern: "ИНВИТРО", categoryName: "Здоровье", priority: 60 },
  { pattern: "HELIX", categoryName: "Здоровье", priority: 60 },
  { pattern: "ХЕЛИКС", categoryName: "Здоровье", priority: 60 },
  // Связь
  { pattern: "MEGAFON", categoryName: "Связь", priority: 55 },
  { pattern: "МЕГАФОН", categoryName: "Связь", priority: 55 },
  { pattern: "MTS", categoryName: "Связь", priority: 55 },
  { pattern: "МТС", categoryName: "Связь", priority: 55 },
  { pattern: "BEELINE", categoryName: "Связь", priority: 55 },
  { pattern: "БИЛАЙН", categoryName: "Связь", priority: 55 },
  { pattern: "TELE2", categoryName: "Связь", priority: 55 },
  // ЖКХ
  { pattern: "ЖИЛИЩНИК", categoryName: "ЖКХ", priority: 60 },
  { pattern: "GKH", categoryName: "ЖКХ", priority: 58 },
  { pattern: "ЖКХ", categoryName: "ЖКХ", priority: 60 },
  { pattern: "КВАРТПЛАТА", categoryName: "ЖКХ", priority: 58 },
  { pattern: "МФЦ", categoryName: "ЖКХ", priority: 50 },
];

async function findOrCreateCategoryByName(
  prisma: PrismaClient,
  name: string
): Promise<{ id: string }> {
  const trimmed = name.trim();
  const found = await prisma.category.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (found) return found;
  return prisma.category.create({
    data: {
      name: trimmed,
      type: "expense",
      color: colorForCategory(trimmed),
      icon: null,
    },
    select: { id: true },
  });
}

/**
 * Создаёт в БД только те стандартные правила, для которых ещё нет записи с таким pattern.
 * При необходимости создаёт категории по имени.
 */
export async function seedMissingDefaultCategoryRules(prisma: PrismaClient): Promise<{
  createdRules: number;
  skippedExisting: number;
}> {
  let createdRules = 0;
  let skippedExisting = 0;

  for (const def of DEFAULT_CATEGORY_RULE_DEFINITIONS) {
    const pattern = def.pattern.trim().toUpperCase();
    const exists = await prisma.categoryRule.findUnique({
      where: { pattern },
      select: { id: true },
    });
    if (exists) {
      skippedExisting += 1;
      continue;
    }
    const category = await findOrCreateCategoryByName(prisma, def.categoryName);
    await prisma.categoryRule.create({
      data: {
        pattern,
        categoryId: category.id,
        priority: def.priority,
        source: "manual",
        isActive: true,
      },
    });
    createdRules += 1;
  }

  return { createdRules, skippedExisting };
}

/** Если в базе ещё нет ни одной категории — создаём категории и полный набор стандартных правил (первый импорт). */
export async function ensureDefaultRulesWhenNoCategories(prisma: PrismaClient): Promise<void> {
  const n = await prisma.category.count();
  if (n > 0) return;
  await seedMissingDefaultCategoryRules(prisma);
}
