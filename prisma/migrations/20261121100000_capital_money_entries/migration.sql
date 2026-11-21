-- CreateEnum
CREATE TYPE "WithdrawalType" AS ENUM ('PROFIT', 'CAPITAL');

-- CreateEnum
CREATE TYPE "MoneyEntryKind" AS ENUM ('OPENING', 'INVESTMENT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "type" "WithdrawalType" NOT NULL DEFAULT 'PROFIT';

-- CreateTable
CREATE TABLE "MoneyEntry" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "kind" "MoneyEntryKind" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoneyEntry_personId_date_idx" ON "MoneyEntry"("personId", "date");

-- AddForeignKey
ALTER TABLE "MoneyEntry" ADD CONSTRAINT "MoneyEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

