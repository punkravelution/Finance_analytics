import path from "node:path";

/**
 * Корень репозитория: при `npm run dev` Next может иметь cwd не в проекте,
 * а npm выставляет INIT_CWD на каталог, откуда вызвали npm.
 */
function projectRoot(): string {
  return process.env.INIT_CWD ?? process.cwd();
}

/**
 * URL для SQLite в корне проекта (`dev.db`).
 * Абсолютный путь без `pathToFileURL`: на Windows кириллица в percent-encoding ломает Prisma (os error 161).
 */
export function defaultSqliteDatabaseUrl(): string {
  const resolved = path.resolve(projectRoot(), "dev.db");
  const normalized = resolved.replace(/\\/g, "/");
  return `file:${normalized}`;
}
