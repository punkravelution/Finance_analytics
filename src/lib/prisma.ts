import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim().length === 0) {
    throw new Error("DATABASE_URL не задан. Добавьте строку подключения PostgreSQL (Neon) в .env.local.");
  }
  return url.trim();
}

function getPool(): Pool {
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new Pool({
      connectionString: getConnectionString(),
      max: process.env.VERCEL ? 5 : 10,
    });
  }
  return globalForPrisma.pgPool;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(getPool());
  const client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production" && client.goal === undefined) {
    throw new Error(
      "Prisma client устарел (нет модели Goal). Выполните `npx prisma generate`, затем перезапустите dev-сервер."
    );
  }

  return client;
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Ленивая инициализация: `next build` не обращается к БД, пока не вызван код,
 * который реально использует клиент (при этом для `npm run build` с миграциями
 * и для Vercel переменная `DATABASE_URL` всё равно нужна на этапе `migrate deploy`).
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
}) as PrismaClient;

/** Для скриптов (seed): закрыть пул и Prisma Client. */
export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
  }
  await globalForPrisma.pgPool?.end();
  globalForPrisma.pgPool = undefined;
  globalForPrisma.prisma = undefined;
}
