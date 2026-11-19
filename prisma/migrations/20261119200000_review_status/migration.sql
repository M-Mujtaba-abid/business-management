-- Review follow-up for delivered orders
CREATE TYPE "ReviewStatus" AS ENUM ('NONE', 'PENDING', 'CALLED', 'REVIEWED', 'DECLINED');

ALTER TABLE "Sale" ADD COLUMN "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Sale" ADD COLUMN "reviewStatusAt" TIMESTAMP(3);

CREATE INDEX "Sale_reviewStatus_idx" ON "Sale"("reviewStatus");

-- Orders already delivered in the last 30 days start as "Review pending";
-- older delivered orders are left out so the list does not start with every old order.
UPDATE "Sale"
SET "reviewStatus" = 'PENDING'
WHERE "status" = 'DELIVERED'
  AND COALESCE("courierStatusAt", "updatedAt") >= NOW() - INTERVAL '30 days';
