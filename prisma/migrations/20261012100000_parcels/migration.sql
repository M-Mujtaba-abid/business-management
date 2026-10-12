-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "parcelId" TEXT;

-- CreateIndex
CREATE INDEX "Sale_parcelId_idx" ON "Sale"("parcelId");

