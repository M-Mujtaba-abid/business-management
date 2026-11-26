-- AlterEnum
ALTER TYPE "StockPaymentKind" ADD VALUE 'ADVANCE';

-- CreateTable
CREATE TABLE "SupplierAdvance" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierAdvance_supplierId_idx" ON "SupplierAdvance"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierAdvance_personId_date_idx" ON "SupplierAdvance"("personId", "date");

-- AddForeignKey
ALTER TABLE "SupplierAdvance" ADD CONSTRAINT "SupplierAdvance_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAdvance" ADD CONSTRAINT "SupplierAdvance_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

