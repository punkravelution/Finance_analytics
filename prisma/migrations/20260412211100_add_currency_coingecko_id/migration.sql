-- AlterTable
ALTER TABLE "Currency" ADD COLUMN "coinGeckoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Currency_coinGeckoId_key" ON "Currency"("coinGeckoId");
