import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Заполнение базы данных тестовыми данными...");

  // ─── Категории ──────────────────────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { id: "cat-salary" },
      update: {},
      create: { id: "cat-salary", name: "Зарплата", type: "income", color: "#22c55e", icon: "💼" },
    }),
    prisma.category.upsert({
      where: { id: "cat-freelance" },
      update: {},
      create: { id: "cat-freelance", name: "Фриланс", type: "income", color: "#16a34a", icon: "💻" },
    }),
    prisma.category.upsert({
      where: { id: "cat-food" },
      update: {},
      create: { id: "cat-food", name: "Продукты", type: "expense", color: "#ef4444", icon: "🛒" },
    }),
    prisma.category.upsert({
      where: { id: "cat-transport" },
      update: {},
      create: { id: "cat-transport", name: "Транспорт", type: "expense", color: "#f97316", icon: "🚗" },
    }),
    prisma.category.upsert({
      where: { id: "cat-entertainment" },
      update: {},
      create: { id: "cat-entertainment", name: "Развлечения", type: "expense", color: "#a855f7", icon: "🎮" },
    }),
    prisma.category.upsert({
      where: { id: "cat-health" },
      update: {},
      create: { id: "cat-health", name: "Здоровье", type: "expense", color: "#ec4899", icon: "💊" },
    }),
    prisma.category.upsert({
      where: { id: "cat-utilities" },
      update: {},
      create: { id: "cat-utilities", name: "Коммунальные", type: "expense", color: "#64748b", icon: "🏠" },
    }),
    prisma.category.upsert({
      where: { id: "cat-investment" },
      update: {},
      create: { id: "cat-investment", name: "Инвестиции", type: "expense", color: "#3b82f6", icon: "📈" },
    }),
    prisma.category.upsert({
      where: { id: "cat-transfer" },
      update: {},
      create: { id: "cat-transfer", name: "Перевод", type: "transfer", color: "#6b7280", icon: "🔄" },
    }),
  ]);

  console.log(`✓ Создано категорий: ${categories.length}`);

  // ─── Хранилища (Vaults) ─────────────────────────────────────────────────────
  const sberbank = await prisma.vault.upsert({
    where: { id: "vault-sber" },
    update: {},
    create: {
      id: "vault-sber",
      name: "Сбербанк",
      type: "bank",
      currency: "RUB",
      liquidityLevel: "high",
      riskLevel: "none",
      color: "#22c55e",
      icon: "🏦",
      sortOrder: 1,
    },
  });

  const tbank = await prisma.vault.upsert({
    where: { id: "vault-tbank" },
    update: {},
    create: {
      id: "vault-tbank",
      name: "Т-Банк",
      type: "bank",
      currency: "RUB",
      liquidityLevel: "high",
      riskLevel: "none",
      color: "#facc15",
      icon: "💳",
      sortOrder: 2,
    },
  });

  const cash = await prisma.vault.upsert({
    where: { id: "vault-cash" },
    update: {},
    create: {
      id: "vault-cash",
      name: "Наличные",
      type: "cash",
      currency: "RUB",
      liquidityLevel: "high",
      riskLevel: "none",
      color: "#84cc16",
      icon: "💵",
      sortOrder: 3,
    },
  });

  const investVault = await prisma.vault.upsert({
    where: { id: "vault-invest" },
    update: {},
    create: {
      id: "vault-invest",
      name: "Брокерский счёт",
      type: "investment",
      currency: "RUB",
      liquidityLevel: "medium",
      riskLevel: "medium",
      valuationMode: "auto",
      color: "#3b82f6",
      icon: "📈",
      sortOrder: 4,
    },
  });

  const cryptoVault = await prisma.vault.upsert({
    where: { id: "vault-crypto" },
    update: {},
    create: {
      id: "vault-crypto",
      name: "Криптокошелёк",
      type: "crypto",
      currency: "USD",
      liquidityLevel: "medium",
      riskLevel: "high",
      valuationMode: "auto",
      color: "#f97316",
      icon: "₿",
      sortOrder: 5,
    },
  });

  const deposit = await prisma.vault.upsert({
    where: { id: "vault-deposit" },
    update: {},
    create: {
      id: "vault-deposit",
      name: "Вклад 15%",
      type: "deposit",
      currency: "RUB",
      liquidityLevel: "low",
      riskLevel: "none",
      color: "#06b6d4",
      icon: "🏧",
      notes: "Вклад на 12 месяцев под 15% годовых",
      sortOrder: 6,
    },
  });

  const steam = await prisma.vault.upsert({
    where: { id: "vault-steam" },
    update: {},
    create: {
      id: "vault-steam",
      name: "Steam-инвентарь",
      type: "steam",
      currency: "USD",
      liquidityLevel: "low",
      riskLevel: "extreme",
      color: "#6366f1",
      icon: "🎮",
      sortOrder: 7,
    },
  });

  console.log("✓ Создано хранилищ: 7");

  // ─── Снимки балансов ────────────────────────────────────────────────────────
  const snapshots = [
    { vaultId: sberbank.id, balance: 145000 },
    { vaultId: tbank.id, balance: 87500 },
    { vaultId: cash.id, balance: 12000 },
    { vaultId: investVault.id, balance: 320000 },
    { vaultId: cryptoVault.id, balance: 95000 },
    { vaultId: deposit.id, balance: 500000 },
    { vaultId: steam.id, balance: 18000 },
  ];

  for (const snap of snapshots) {
    await prisma.vaultSnapshot.create({
      data: {
        vaultId: snap.vaultId,
        date: new Date(),
        balance: snap.balance,
        source: "seed",
      },
    });
  }

  // Снимки 30 дней назад для расчёта изменения капитала
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oldSnapshots = [
    { vaultId: sberbank.id, balance: 130000 },
    { vaultId: tbank.id, balance: 75000 },
    { vaultId: cash.id, balance: 8000 },
    { vaultId: investVault.id, balance: 295000 },
    { vaultId: cryptoVault.id, balance: 80000 },
    { vaultId: deposit.id, balance: 500000 },
    { vaultId: steam.id, balance: 16000 },
  ];
  for (const snap of oldSnapshots) {
    await prisma.vaultSnapshot.create({
      data: {
        vaultId: snap.vaultId,
        date: thirtyDaysAgo,
        balance: snap.balance,
        source: "seed",
      },
    });
  }

  console.log("✓ Созданы снимки балансов");

  // ─── Активы ─────────────────────────────────────────────────────────────────
  await prisma.asset.upsert({
    where: { id: "asset-sber-stock" },
    update: {},
    create: {
      id: "asset-sber-stock",
      vaultId: investVault.id,
      name: "Сбербанк (акции)",
      assetType: "stock",
      ticker: "SBER",
      quantity: 100,
      unit: "шт",
      averageBuyPrice: 260,
      currentUnitPrice: 295,
      currentTotalValue: 29500,
      currency: "RUB",
    },
  });

  await prisma.asset.upsert({
    where: { id: "asset-gazp" },
    update: {},
    create: {
      id: "asset-gazp",
      vaultId: investVault.id,
      name: "Газпром",
      assetType: "stock",
      ticker: "GAZP",
      quantity: 200,
      unit: "шт",
      averageBuyPrice: 175,
      currentUnitPrice: 160,
      currentTotalValue: 32000,
      currency: "RUB",
    },
  });

  await prisma.asset.upsert({
    where: { id: "asset-ofz" },
    update: {},
    create: {
      id: "asset-ofz",
      vaultId: investVault.id,
      name: "ОФЗ 26238",
      assetType: "bond",
      ticker: "SU26238RMFS3",
      quantity: 50,
      unit: "шт",
      averageBuyPrice: 5200,
      currentUnitPrice: 5340,
      currentTotalValue: 267000,
      currency: "RUB",
    },
  });

  await prisma.asset.upsert({
    where: { id: "asset-btc" },
    update: {},
    create: {
      id: "asset-btc",
      vaultId: cryptoVault.id,
      name: "Bitcoin",
      assetType: "crypto",
      ticker: "BTC",
      quantity: 0.0012,
      unit: "BTC",
      averageBuyPrice: 58000,
      currentUnitPrice: 84000,
      currentTotalValue: 100.8,
      currency: "USD",
    },
  });

  await prisma.asset.upsert({
    where: { id: "asset-eth" },
    update: {},
    create: {
      id: "asset-eth",
      vaultId: cryptoVault.id,
      name: "Ethereum",
      assetType: "crypto",
      ticker: "ETH",
      quantity: 0.15,
      unit: "ETH",
      averageBuyPrice: 2800,
      currentUnitPrice: 1950,
      currentTotalValue: 292.5,
      currency: "USD",
    },
  });

  await prisma.asset.upsert({
    where: { id: "asset-cs-knife" },
    update: {},
    create: {
      id: "asset-cs-knife",
      vaultId: steam.id,
      name: "Karambit | Fade (FN)",
      assetType: "item",
      quantity: 1,
      unit: "шт",
      currentUnitPrice: 180,
      currentTotalValue: 180,
      currency: "USD",
      sourceType: "manual",
    },
  });

  console.log("✓ Создано активов: 6");

  // ─── Транзакции ─────────────────────────────────────────────────────────────
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const transactions = [
    { date: new Date(year, month, 5), type: "income", amount: 120000, toVaultId: sberbank.id, categoryId: "cat-salary", note: "Зарплата за март" },
    { date: new Date(year, month, 8), type: "income", amount: 35000, toVaultId: tbank.id, categoryId: "cat-freelance", note: "Проект веб-сайт" },
    { date: new Date(year, month, 1), type: "expense", amount: 4500, fromVaultId: tbank.id, categoryId: "cat-food", note: "Пятёрочка" },
    { date: new Date(year, month, 3), type: "expense", amount: 2800, fromVaultId: tbank.id, categoryId: "cat-transport", note: "Заправка" },
    { date: new Date(year, month, 4), type: "expense", amount: 1200, fromVaultId: tbank.id, categoryId: "cat-utilities", note: "Интернет" },
    { date: new Date(year, month, 6), type: "expense", amount: 3200, fromVaultId: sberbank.id, categoryId: "cat-food", note: "Гипермаркет" },
    { date: new Date(year, month, 7), type: "expense", amount: 800, fromVaultId: tbank.id, categoryId: "cat-entertainment", note: "Кино" },
    { date: new Date(year, month, 9), type: "expense", amount: 1500, fromVaultId: sberbank.id, categoryId: "cat-health", note: "Аптека" },
    { date: new Date(year, month, 10), type: "expense", amount: 45000, fromVaultId: sberbank.id, categoryId: "cat-investment", note: "Пополнение брокерского" },
    { date: new Date(year, month, 10), type: "income", amount: 45000, toVaultId: investVault.id, categoryId: "cat-investment", note: "Пополнение от Сбера" },
    { date: new Date(year, month, 2), type: "transfer", amount: 20000, fromVaultId: sberbank.id, toVaultId: tbank.id, categoryId: "cat-transfer", note: "На расходы" },
    { date: new Date(year, month - 1, 5), type: "income", amount: 120000, toVaultId: sberbank.id, categoryId: "cat-salary", note: "Зарплата за февраль" },
    { date: new Date(year, month - 1, 10), type: "expense", amount: 5100, fromVaultId: tbank.id, categoryId: "cat-food", note: "Продукты" },
    { date: new Date(year, month - 1, 15), type: "expense", amount: 3400, fromVaultId: tbank.id, categoryId: "cat-transport", note: "Транспорт" },
  ];

  for (const tx of transactions) {
    await prisma.transaction.create({ data: { ...tx } as Parameters<typeof prisma.transaction.create>[0]["data"] });
  }

  console.log(`✓ Создано транзакций: ${transactions.length}`);

  // ─── Доходные события ───────────────────────────────────────────────────────
  await prisma.incomeEvent.create({
    data: {
      assetId: "asset-ofz",
      vaultId: investVault.id,
      date: new Date(year, month - 1, 20),
      amount: 1340,
      incomeType: "coupon",
      note: "Купонный доход ОФЗ 26238",
    },
  });

  await prisma.incomeEvent.create({
    data: {
      assetId: "asset-eth",
      vaultId: cryptoVault.id,
      date: new Date(year, month - 2, 15),
      amount: 12,
      currency: "USD",
      incomeType: "staking",
      note: "Стейкинг ETH",
    },
  });

  console.log("✓ Созданы доходные события");
  console.log("\n🎉 База данных заполнена успешно!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Общий капитал (approx): ${(145000 + 87500 + 12000 + 320000 + 95000 + 500000 + 18000).toLocaleString("ru-RU")} ₽`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
