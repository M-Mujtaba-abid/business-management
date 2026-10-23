-- Customer phone number on orders.
-- (20261023100000_customer_phone was generated empty while the database was unreachable;
--  this migration adds the column. IF NOT EXISTS keeps it safe to run anywhere.)
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
