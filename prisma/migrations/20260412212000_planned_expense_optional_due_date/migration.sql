-- AlterTable: запланированный платёж может быть без конкретной даты
ALTER TABLE "PlannedExpense" ALTER COLUMN "dueDate" DROP NOT NULL;
