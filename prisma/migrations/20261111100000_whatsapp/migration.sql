-- CreateEnum
CREATE TYPE "CustomerResponse" AS ENUM ('NONE', 'PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WhatsAppKind" AS ENUM ('ORDER_CONFIRM', 'DISPATCHED', 'DELIVERED', 'REPLY_ACK');

-- CreateEnum
CREATE TYPE "WhatsAppStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable: customer's WhatsApp confirm / cancel reply
ALTER TABLE "Sale" ADD COLUMN     "customerResponse" "CustomerResponse" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "customerRespondedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Sale_customerResponse_idx" ON "Sale"("customerResponse");

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "kind" "WhatsAppKind" NOT NULL,
    "body" TEXT NOT NULL,
    "status" "WhatsAppStatus" NOT NULL DEFAULT 'PENDING',
    "waMessageId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_waMessageId_key" ON "WhatsAppMessage"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_phone_idx" ON "WhatsAppMessage"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_orderNo_kind_key" ON "WhatsAppMessage"("orderNo", "kind");
