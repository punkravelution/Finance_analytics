import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** pdf-parse (pdfjs) не должен бандлиться в server chunks — иначе часто падает чтение PDF */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
