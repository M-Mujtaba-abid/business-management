-- CreateEnum
CREATE TYPE "CustomerPayment" AS ENUM ('NOT_RECEIVED', 'RECEIVED', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "paymentReceivedAt" TIMESTAMP(3),
ADD COLUMN     "paymentSourceId" TEXT,
ADD COLUMN     "paymentStatus" "CustomerPayment" NOT NULL DEFAULT 'NOT_RECEIVED';

-- CreateTable
CREATE TABLE "PaymentSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSource_name_key" ON "PaymentSource"("name");

-- CreateIndex
CREATE INDEX "Sale_paymentSourceId_idx" ON "Sale"("paymentSourceId");

-- CreateIndex
CREATE INDEX "Sale_paymentStatus_idx" ON "Sale"("paymentStatus");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_paymentSourceId_fkey" FOREIGN KEY ("paymentSourceId") REFERENCES "PaymentSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Existing orders: payment tracking starts with new orders only
UPDATE "Sale" SET "paymentStatus" = 'NOT_APPLICABLE';

-- Default payment sources
INSERT INTO "PaymentSource" ("id", "name") VALUES
  ('src_daraz', 'Daraz'),
  ('src_leopards', 'Leopards')
ON CONFLICT ("name") DO NOTHING;
