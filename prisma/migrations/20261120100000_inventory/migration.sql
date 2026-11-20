-- CreateEnum
CREATE TYPE "StockPaymentKind" AS ENUM ('BUSINESS', 'SAVINGS');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "inventoryHeld" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inventoryItemId" TEXT;

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "supplierId" TEXT,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "avgCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salePrice" DOUBLE PRECISION,
    "lowStockAt" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockPurchase" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "supplierId" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockPayment" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "kind" "StockPaymentKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLog" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "qtyChange" INTEGER NOT NULL DEFAULT 0,
    "qtyAfter" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "orderNo" INTEGER,
    "saleId" TEXT,
    "purchaseId" TEXT,
    "message" TEXT NOT NULL,
    "source" "LogSource" NOT NULL,
    "actor" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItem_active_idx" ON "InventoryItem"("active");

-- CreateIndex
CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");

-- CreateIndex
CREATE INDEX "StockPurchase_itemId_idx" ON "StockPurchase"("itemId");

-- CreateIndex
CREATE INDEX "StockPurchase_createdAt_idx" ON "StockPurchase"("createdAt");

-- CreateIndex
CREATE INDEX "StockPayment_personId_idx" ON "StockPayment"("personId");

-- CreateIndex
CREATE INDEX "StockPayment_purchaseId_idx" ON "StockPayment"("purchaseId");

-- CreateIndex
CREATE INDEX "InventoryLog_itemId_createdAt_idx" ON "InventoryLog"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryLog_createdAt_idx" ON "InventoryLog"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryLog_orderNo_idx" ON "InventoryLog"("orderNo");

-- CreateIndex
CREATE INDEX "Sale_inventoryItemId_idx" ON "Sale"("inventoryItemId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPurchase" ADD CONSTRAINT "StockPurchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPurchase" ADD CONSTRAINT "StockPurchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPayment" ADD CONSTRAINT "StockPayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "StockPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPayment" ADD CONSTRAINT "StockPayment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

