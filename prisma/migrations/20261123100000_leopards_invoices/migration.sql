-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "courierInvoiceNo" TEXT,
ADD COLUMN     "courierMoneyAuto" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LeopardsInvoice" (
    "invoiceNo" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "bankName" TEXT,
    "method" TEXT,
    "leopardsStatus" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "markedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeopardsInvoice_pkey" PRIMARY KEY ("invoiceNo")
);

-- CreateIndex
CREATE INDEX "LeopardsInvoice_receivedById_idx" ON "LeopardsInvoice"("receivedById");

-- CreateIndex
CREATE INDEX "Sale_courierInvoiceNo_idx" ON "Sale"("courierInvoiceNo");

-- AddForeignKey
ALTER TABLE "LeopardsInvoice" ADD CONSTRAINT "LeopardsInvoice_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
