-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "recurringIncomeId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "subscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_recurringIncomeId_idx" ON "Transaction"("recurringIncomeId");

-- CreateIndex
CREATE INDEX "Transaction_subscriptionId_idx" ON "Transaction"("subscriptionId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurringIncomeId_fkey" FOREIGN KEY ("recurringIncomeId") REFERENCES "RecurringIncome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
