-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "externalOrderId" TEXT,
ADD COLUMN     "orderNo" INTEGER,
ADD COLUMN     "trackingNumber" TEXT;

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Sale_orderNo_idx" ON "Sale"("orderNo");

-- CreateIndex
CREATE INDEX "Sale_externalOrderId_idx" ON "Sale"("externalOrderId");

-- CreateIndex
CREATE INDEX "Sale_trackingNumber_idx" ON "Sale"("trackingNumber");


-- Number existing orders 1001, 1002... in the order they were created (a parcel shares one number)
WITH orders AS (
  SELECT COALESCE("parcelId", "id") AS k, MIN("createdAt") AS c
  FROM "Sale"
  GROUP BY 1
), numbered AS (
  SELECT k, (1000 + ROW_NUMBER() OVER (ORDER BY c, k))::int AS n
  FROM orders
)
UPDATE "Sale" s
SET "orderNo" = numbered.n
FROM numbered
WHERE COALESCE(s."parcelId", s."id") = numbered.k;

-- Next new order continues after the highest number
INSERT INTO "Counter" ("key", "value")
SELECT 'orderNo', COALESCE(MAX("orderNo"), 1000) FROM "Sale"
ON CONFLICT ("key") DO NOTHING;
