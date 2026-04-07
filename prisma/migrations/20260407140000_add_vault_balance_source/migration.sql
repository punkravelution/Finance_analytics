-- AlterTable: add explicit balance source and manual balance to Vault
ALTER TABLE "Vault" ADD COLUMN "balanceSource" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Vault" ADD COLUMN "manualBalance" REAL NOT NULL DEFAULT 0;
