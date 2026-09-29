-- CreateEnum
CREATE TYPE "SupplierPayment" AS ENUM ('PENDING', 'PAID', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ReturnedItemStatus" AS ENUM ('AVAILABLE', 'USED');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "petrolCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "returnLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "returnedItemId" TEXT,
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "supplierPaidAt" TIMESTAMP(3),
ADD COLUMN     "supplierPaymentStatus" "SupplierPayment" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnedItem" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "categoryId" TEXT,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sourceSaleId" TEXT NOT NULL,
    "usedInSaleId" TEXT,
    "status" "ReturnedItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "ReturnedItem_status_idx" ON "ReturnedItem"("status");

-- CreateIndex
CREATE INDEX "ReturnedItem_sourceSaleId_idx" ON "ReturnedItem"("sourceSaleId");

-- CreateIndex
CREATE INDEX "Sale_categoryId_idx" ON "Sale"("categoryId");

-- CreateIndex
CREATE INDEX "Sale_supplierId_idx" ON "Sale"("supplierId");

-- CreateIndex
CREATE INDEX "Sale_supplierPaymentStatus_idx" ON "Sale"("supplierPaymentStatus");

-- AddForeignKey
ALTER TABLE "ReturnedItem" ADD CONSTRAINT "ReturnedItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Old (inventory-based) orders have no market supplier to pay
UPDATE "Sale" SET "supplierPaymentStatus" = 'NOT_APPLICABLE';

-- Default categories
INSERT INTO "Category" ("id", "name") VALUES
  ('cat_car_top_cover', 'Car Top Cover'),
  ('cat_bike_top_cover', 'Bike Top Cover'),
  ('cat_bike_seat_cover', 'Bike Seat Cover'),
  ('cat_scooty_mats', 'Scooty Mats')
ON CONFLICT ("name") DO NOTHING;

-- Default market suppliers
INSERT INTO "Supplier" ("id", "name", "unpaidBalance", "createdAt", "updatedAt")
SELECT 'sup_faizan', 'Faizan', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Supplier" WHERE LOWER("name") = 'faizan');

INSERT INTO "Supplier" ("id", "name", "unpaidBalance", "createdAt", "updatedAt")
SELECT 'sup_yousaf', 'Yousaf', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Supplier" WHERE LOWER("name") = 'yousaf');
