-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "plannedExpenseId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_plannedExpenseId_idx" ON "Transaction"("plannedExpenseId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_plannedExpenseId_fkey" FOREIGN KEY ("plannedExpenseId") REFERENCES "PlannedExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
