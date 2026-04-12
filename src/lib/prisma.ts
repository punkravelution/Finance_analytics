import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { defaultSqliteDatabaseUrl } from "./sqliteUrl";

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? defaultSqliteDatabaseUrl();
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  const client = new PrismaClient({ adapter });

  // After schema changes, a hot-reloaded dev server can keep an old global client
  // without Goal / PlannedExpense delegates until restart + prisma generate.
  if (process.env.NODE_ENV !== "production" && client.goal === undefined) {
    throw new Error(
      "Prisma client устарел (нет модели Goal). Остановите `next dev`, выполните `npx prisma generate`, затем снова запустите dev-сервер."
    );
  }

  return client;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaV2: PrismaClient | undefined;
  prismaSchemaV3: PrismaClient | undefined;
  prismaSchemaV4: PrismaClient | undefined;
  prismaSchemaV5: PrismaClient | undefined;
};

// Use a versioned global slot to avoid stale Prisma client shape
// after schema changes during dev server hot reload.
export const prisma = globalForPrisma.prismaSchemaV5 ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaSchemaV5 = prisma;
}
