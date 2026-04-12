-- CreateTable
CREATE TABLE "ImportSession" (
    "id" TEXT NOT NULL,
    "bankSource" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportSession_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "importSessionId" TEXT;

-- CreateIndex
CREATE INDEX "ImportSession_vaultId_bankSource_idx" ON "ImportSession"("vaultId", "bankSource");

-- CreateIndex
CREATE INDEX "ImportSession_dateFrom_dateTo_idx" ON "ImportSession"("dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "Transaction_importSessionId_idx" ON "Transaction"("importSessionId");

-- AddForeignKey
ALTER TABLE "ImportSession" ADD CONSTRAINT "ImportSession_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
