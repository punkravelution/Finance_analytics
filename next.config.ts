import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Фиксируем корень воркспейса, чтобы убрать warning о нескольких lockfile.
    root: process.cwd(),
  },
  /**
   * pdf-parse тянет pdf.js через динамический require — не бандлим, иначе часто ломается чтение PDF.
   * Для serverless явно добавляем пакет в file tracing (иначе require("pdf-parse") не находится в /var/task).
   */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/import-bank": ["./node_modules/pdf-parse/**/*"],
    "/api/import-bank/preview": ["./node_modules/pdf-parse/**/*"],
  },
};

export default nextConfig;
