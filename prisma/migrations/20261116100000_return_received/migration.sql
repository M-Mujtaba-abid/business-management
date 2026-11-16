-- Returned orders: has the parcel physically come back yet?
ALTER TABLE "Sale" ADD COLUMN "returnedAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "returnReceived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Sale" ADD COLUMN "returnReceivedAt" TIMESTAMP(3);

CREATE INDEX "Sale_status_returnReceived_idx" ON "Sale"("status", "returnReceived");

-- Existing returns: the last time the order changed is the best guess for when it was returned.
-- Returns older than 10 days have surely arrived by now; newer ones stay "pending" to check.
UPDATE "Sale" SET "returnedAt" = "updatedAt" WHERE "status" = 'RETURNED';
UPDATE "Sale" SET "returnReceived" = true, "returnReceivedAt" = "updatedAt"
WHERE "status" = 'RETURNED' AND "updatedAt" < NOW() - INTERVAL '10 days';
