-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "liabilityId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_liabilityId_idx" ON "Transaction"("liabilityId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "Liability"("id") ON DELETE SET NULL ON UPDATE CASCADE;
