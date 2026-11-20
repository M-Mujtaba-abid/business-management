-- CreateTable
CREATE TABLE "BankCheck" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankBalance" DOUBLE PRECISION NOT NULL,
    "inHand" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankCheck_personId_createdAt_idx" ON "BankCheck"("personId", "createdAt");

-- AddForeignKey
ALTER TABLE "BankCheck" ADD CONSTRAINT "BankCheck_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

