-- Leopards money per parcel: COD, charges, payout and whether Leopards has paid
ALTER TABLE "Sale" ADD COLUMN "courierCod" DOUBLE PRECISION;
ALTER TABLE "Sale" ADD COLUMN "courierCharges" DOUBLE PRECISION;
ALTER TABLE "Sale" ADD COLUMN "courierPayout" DOUBLE PRECISION;
ALTER TABLE "Sale" ADD COLUMN "courierPayment" TEXT;
ALTER TABLE "Sale" ADD COLUMN "courierMoney" JSONB;
ALTER TABLE "Sale" ADD COLUMN "courierMoneyAt" TIMESTAMP(3);
