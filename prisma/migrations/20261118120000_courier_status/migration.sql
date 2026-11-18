-- Latest Leopards courier status per order (pushed by Leopards to /api/leopards/push)
ALTER TABLE "Sale" ADD COLUMN "courierStatus" TEXT;
ALTER TABLE "Sale" ADD COLUMN "courierStatusCode" TEXT;
ALTER TABLE "Sale" ADD COLUMN "courierReason" TEXT;
ALTER TABLE "Sale" ADD COLUMN "courierStatusAt" TIMESTAMP(3);
