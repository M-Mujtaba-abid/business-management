-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "dcPaidById" TEXT;

-- CreateIndex
CREATE INDEX "Sale_dcPaidById_idx" ON "Sale"("dcPaidById");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_dcPaidById_fkey" FOREIGN KEY ("dcPaidById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
