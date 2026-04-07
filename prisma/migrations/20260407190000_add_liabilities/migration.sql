-- CreateTable
CREATE TABLE "Liability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "principalAmount" REAL NOT NULL,
    "currentBalance" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "interestRate" REAL,
    "minimumPayment" REAL,
    "nextPaymentDate" DATETIME,
    "lender" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
