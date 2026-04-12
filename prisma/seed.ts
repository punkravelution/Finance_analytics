import "dotenv/config";
import { disconnectPrisma, prisma } from "../src/lib/prisma";

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

  // ─── Справочник валют ────────────────────────────────────────────────────────
  const currencies = await Promise.all([
    prisma.currency.upsert({
      where: { code: "RUB" },
      update: { name: "Российский рубль", symbol: "₽", isActive: true, sortOrder: 1 },
      create: { code: "RUB", name: "Российский рубль", symbol: "₽", isActive: true, sortOrder: 1 },
    }),
    prisma.currency.upsert({
      where: { code: "USD" },
      update: { name: "Доллар США", symbol: "$", isActive: true, sortOrder: 2 },
      create: { code: "USD", name: "Доллар США", symbol: "$", isActive: true, sortOrder: 2 },
    }),
    prisma.currency.upsert({
      where: { code: "EUR" },
      update: { name: "Евро", symbol: "€", isActive: true, sortOrder: 3 },
      create: { code: "EUR", name: "Евро", symbol: "€", isActive: true, sortOrder: 3 },
    }),
  ]);
  console.log(`✓ Валют в справочнике: ${currencies.length}`);

  // ─── Хранилища (Vaults) ─────────────────────────────────────────────────────
  // bank/MANUAL — доступный + ликвидный + общий
  const sberbank = await prisma.vault.upsert({
    where: { id: "vault-sber" },
    update: { balanceSource: "MANUAL", manualBalance: 0, includeInSpendableBalance: true, includeInLiquidCapital: true },
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
      balanceSource: "MANUAL",
      manualBalance: 0,
      includeInSpendableBalance: true,
      includeInLiquidCapital: true,
    },
  });

  // bank/MANUAL — доступный + ликвидный + общий
  const tbank = await prisma.vault.upsert({
    where: { id: "vault-tbank" },
    update: { balanceSource: "MANUAL", manualBalance: 0, includeInSpendableBalance: true, includeInLiquidCapital: true },
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
      balanceSource: "MANUAL",
      manualBalance: 0,
      includeInSpendableBalance: true,
      includeInLiquidCapital: true,
    },
  });

  // cash/MANUAL — доступный + ликвидный + общий
  const cash = await prisma.vault.upsert({
    where: { id: "vault-cash" },
    update: { balanceSource: "MANUAL", manualBalance: 0, includeInSpendableBalance: true, includeInLiquidCapital: true },
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
      balanceSource: "MANUAL",
      manualBalance: 0,
      includeInSpendableBalance: true,
      includeInLiquidCapital: true,
    },
  });

  // investment/ASSETS — не доступный, но ликвидный + общий
  const investVault = await prisma.vault.upsert({
    where: { id: "vault-invest" },
    update: { balanceSource: "ASSETS", manualBalance: 0, includeInSpendableBalance: false, includeInLiquidCapital: true },
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
      balanceSource: "ASSETS",
      manualBalance: 0,
      includeInSpendableBalance: false,
      includeInLiquidCapital: true,
    },
  });

  // crypto/ASSETS — не доступный, но ликвидный + общий
  const cryptoVault = await prisma.vault.upsert({
    where: { id: "vault-crypto" },
    update: { balanceSource: "ASSETS", manualBalance: 0, includeInSpendableBalance: false, includeInLiquidCapital: true },
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
      balanceSource: "ASSETS",
      manualBalance: 0,
      includeInSpendableBalance: false,
      includeInLiquidCapital: true,
    },
  });

  // deposit/MANUAL — не доступный, не ликвидный, только общий
  const deposit = await prisma.vault.upsert({
    where: { id: "vault-deposit" },
    update: { balanceSource: "MANUAL", manualBalance: 0, includeInSpendableBalance: false, includeInLiquidCapital: false },
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
      balanceSource: "MANUAL",
      manualBalance: 0,
      includeInSpendableBalance: false,
      includeInLiquidCapital: false,
    },
  });

  // steam/ASSETS — не доступный, не ликвидный, только общий капитал
  const steam = await prisma.vault.upsert({
    where: { id: "vault-steam" },
    update: { balanceSource: "ASSETS", manualBalance: 0, includeInSpendableBalance: false, includeInLiquidCapital: false },
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
      balanceSource: "ASSETS",
      manualBalance: 0,
      includeInSpendableBalance: false,
      includeInLiquidCapital: false,
    },
  });

  console.log("✓ Создано хранилищ: 7");

  // ─── Активы (только для ASSETS-хранилищ) ───────────────────────────────────
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

  // Транзакции и доходные события не создаются — чистый старт.
  // Пользователь добавляет свои данные через интерфейс.

  // ─── Курсы валют ────────────────────────────────────────────────────────────
  const rateDate = new Date();

  const exchangeRates = [
    // RUB → RUB (явно, для полноты)
    { fromCurrency: "RUB", toCurrency: "RUB", rate: 1 },
    // USD → RUB
    { fromCurrency: "USD", toCurrency: "RUB", rate: 90.5 },
    // EUR → RUB
    { fromCurrency: "EUR", toCurrency: "RUB", rate: 98.2 },
    // RUB → USD (обратный, для удобства)
    { fromCurrency: "RUB", toCurrency: "USD", rate: 1 / 90.5 },
  ];

  for (const r of exchangeRates) {
    await prisma.exchangeRate.create({
      data: {
        fromCurrency: r.fromCurrency,
        toCurrency: r.toCurrency,
        rate: r.rate,
        date: rateDate,
        source: "seed",
      },
    });
  }

  console.log(`✓ Создано курсов валют: ${exchangeRates.length}`);

  // ─── Настройки приложения ───────────────────────────────────────────────────
  await prisma.appSettings.upsert({
    where: { key: "baseCurrency" },
    update: { value: "RUB" },
    create: { key: "baseCurrency", value: "RUB" },
  });

  console.log("✓ Базовая валюта установлена: RUB");

  // ─── Подписки ────────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.subscription.upsert({
      where: { id: "sub-cursor" },
      update: {},
      create: {
        id: "sub-cursor",
        name: "Cursor Pro",
        amount: 20,
        currency: "USD",
        billingPeriod: "monthly",
        nextChargeDate: new Date(),
        category: "AI инструменты",
        vaultId: tbank.id,
        isEssential: true,
      },
    }),
    prisma.subscription.upsert({
      where: { id: "sub-chatgpt" },
      update: {},
      create: {
        id: "sub-chatgpt",
        name: "ChatGPT Plus",
        amount: 20,
        currency: "USD",
        billingPeriod: "monthly",
        nextChargeDate: new Date(),
        category: "AI инструменты",
        vaultId: tbank.id,
        isEssential: false,
      },
    }),
    prisma.subscription.upsert({
      where: { id: "sub-spotify" },
      update: {},
      create: {
        id: "sub-spotify",
        name: "Spotify",
        amount: 199,
        currency: "RUB",
        billingPeriod: "monthly",
        nextChargeDate: new Date(),
        category: "Развлечения",
        vaultId: sberbank.id,
        isEssential: false,
      },
    }),
    prisma.subscription.upsert({
      where: { id: "sub-mobile" },
      update: {},
      create: {
        id: "sub-mobile",
        name: "Мобильная связь",
        amount: 650,
        currency: "RUB",
        billingPeriod: "monthly",
        nextChargeDate: new Date(),
        category: "Связь",
        vaultId: sberbank.id,
        isEssential: true,
      },
    }),
  ]);
  console.log("✓ Добавлены тестовые подписки");

  // ─── Долги / обязательства ─────────────────────────────────────────────────
  await Promise.all([
    prisma.liability.upsert({
      where: { id: "liability-cc" },
      update: {},
      create: {
        id: "liability-cc",
        name: "Кредитная карта Т-Банк",
        type: "credit_card",
        principalAmount: 120000,
        currentBalance: 28500,
        currency: "RUB",
        interestRate: 29.9,
        minimumPayment: 2500,
        nextPaymentDate: new Date(),
        lender: "Т-Банк",
        isActive: true,
      },
    }),
    prisma.liability.upsert({
      where: { id: "liability-installment" },
      update: {},
      create: {
        id: "liability-installment",
        name: "Рассрочка на ноутбук",
        type: "installment",
        principalAmount: 95000,
        currentBalance: 38000,
        currency: "RUB",
        interestRate: 0,
        minimumPayment: 7900,
        nextPaymentDate: new Date(),
        lender: "Магазин техники",
        isActive: true,
      },
    }),
    prisma.liability.upsert({
      where: { id: "liability-loan" },
      update: {},
      create: {
        id: "liability-loan",
        name: "Займ у знакомого",
        type: "loan",
        principalAmount: 1000,
        currentBalance: 600,
        currency: "USD",
        interestRate: null,
        minimumPayment: 100,
        nextPaymentDate: new Date(),
        lender: "Частное лицо",
        isActive: true,
      },
    }),
  ]);
  console.log("✓ Добавлены тестовые долги");

  console.log("\n🎉 База данных заполнена успешно!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Чистый старт: балансы = 0, добавьте свои данные через интерфейс.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
