-- AlterTable: add balance mode participation flags to Vault
ALTER TABLE "Vault" ADD COLUMN "includeInSpendableBalance" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Vault" ADD COLUMN "includeInLiquidCapital" BOOLEAN NOT NULL DEFAULT true;
