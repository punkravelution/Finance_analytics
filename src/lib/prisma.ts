import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { defaultSqliteDatabaseUrl } from "./sqliteUrl";

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL ?? defaultSqliteDatabaseUrl();
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaV2: PrismaClient | undefined;
  prismaSchemaV3: PrismaClient | undefined;
};

// Use a versioned global slot to avoid stale Prisma client shape
// after schema changes during dev server hot reload.
export const prisma = globalForPrisma.prismaSchemaV3 ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaSchemaV3 = prisma;
}
