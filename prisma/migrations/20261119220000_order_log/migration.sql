-- Order history (who did what, when) for every order
CREATE TYPE "LogSource" AS ENUM ('USER', 'LEOPARDS', 'WHATSAPP', 'CUSTOMER', 'SYSTEM');

CREATE TABLE "OrderLog" (
    "id" TEXT NOT NULL,
    "orderNo" INTEGER,
    "saleId" TEXT,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" "LogSource" NOT NULL,
    "actor" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderLog_orderNo_createdAt_idx" ON "OrderLog"("orderNo", "createdAt");
CREATE INDEX "OrderLog_saleId_idx" ON "OrderLog"("saleId");
CREATE INDEX "OrderLog_createdAt_idx" ON "OrderLog"("createdAt");

-- ── History for orders that already exist, rebuilt from what the database remembers ──
-- (marked {"backfilled": true}; only events with a known date are added)

CREATE TEMP TABLE bf_orders AS
SELECT
  MAX(s."orderNo") AS order_no,
  (ARRAY_AGG(s."id" ORDER BY s."createdAt", s."id"))[1] AS lead_id,
  MIN(s."createdAt") AS created_at,
  MAX(s."customerName") AS customer,
  SUM(s."soldPrice" * s."quantity") AS total,
  SUM(COALESCE(s."receivedAmount", s."soldPrice" * s."quantity")) AS payout,
  COUNT(*) AS items,
  MAX(s."paymentStatus"::text) AS payment_status,
  MAX(s."paymentReceivedAt") AS paid_at,
  MAX(p."name") AS received_by,
  MAX(s."supplierPaidAt") AS supplier_paid_at,
  MAX(s."returnedAt") AS returned_at,
  MAX(s."returnReceivedAt") AS return_received_at,
  MAX(s."customerResponse"::text) AS response,
  MAX(s."customerRespondedAt") AS responded_at,
  MAX(s."courierStatus") AS courier_status,
  MAX(s."courierStatusAt") AS courier_at
FROM "Sale" s
LEFT JOIN "Person" p ON p."id" = s."receivedById"
GROUP BY COALESCE(s."orderNo"::text, s."parcelId", s."id");

INSERT INTO "OrderLog" ("id", "orderNo", "saleId", "action", "message", "source", "actor", "details", "createdAt")
SELECT 'bf_' || md5(random()::text || clock_timestamp()::text), order_no, lead_id, 'created',
       'Order created: ' || COALESCE(customer, 'customer') || ' · Rs. ' || to_char(total, 'FM999,999,990')
         || CASE WHEN items > 1 THEN ' (' || items || ' items)' ELSE '' END,
       'SYSTEM', NULL, '{"backfilled": true}'::jsonb, created_at
FROM bf_orders;

INSERT INTO "OrderLog" ("id", "orderNo", "saleId", "action", "message", "source", "actor", "details", "createdAt")
SELECT 'bf_' || md5(random()::text || clock_timestamp()::text), order_no, lead_id, 'payment',
       'Payment received · Rs. ' || to_char(payout, 'FM999,999,990') || COALESCE(' → ' || received_by, ''),
       'SYSTEM', NULL, '{"backfilled": true}'::jsonb, paid_at
FROM bf_orders WHERE payment_status = 'RECEIVED' AND paid_at IS NOT NULL;

INSERT INTO "OrderLog" ("id", "orderNo", "saleId", "action", "message", "source", "actor", "details", "createdAt")
SELECT 'bf_' || md5(random()::text || clock_timestamp()::text), order_no, lead_id, 'supplier_payment',
       'Supplier marked paid', 'SYSTEM', NULL, '{"backfilled": true}'::jsonb, supplier_paid_at
FROM bf_orders WHERE supplier_paid_at IS NOT NULL;

INSERT INTO "OrderLog" ("id", "orderNo", "saleId", "action", "message", "source", "actor", "details", "createdAt")
SELECT 'bf_' || md5(random()::text || clock_timestamp()::text), order_no, lead_id, 'status',
       'Status → Returned', 'SYSTEM', NULL, '{"backfilled": true}'::jsonb, returned_at
FROM bf_orders WHERE returned_at IS NOT NULL;

INSERT INTO "OrderLog" ("id", "orderNo", "saleId", "action", "message", "source", "actor", "details", "createdAt")
SELECT 'bf_' || md5(random()::text || clock_timestamp()::text), order_no, lead_id, 'return_received',
       'Returned parcel received back', 'SYSTEM', NULL, '{"backfilled": true}'::jsonb, return_received_at
FROM bf_orders WHERE return_received_at IS NOT NULL;

INSERT INTO "OrderLog" ("id", "orderNo", "saleId", "action", "message", "source", "actor", "details", "createdAt")
SELECT 'bf_' || md5(random()::text || clock_timestamp()::text), order_no, lead_id, 'customer_response',
       CASE response WHEN 'CONFIRMED' THEN 'Customer confirmed the order on WhatsApp' ELSE 'Customer cancelled the order on WhatsApp' END,
       'CUSTOMER', customer, '{"backfilled": true}'::jsonb, responded_at
FROM bf_orders WHERE responded_at IS NOT NULL AND response IN ('CONFIRMED', 'CANCELLED');

INSERT INTO "OrderLog" ("id", "orderNo", "saleId", "action", "message", "source", "actor", "details", "createdAt")
SELECT 'bf_' || md5(random()::text || clock_timestamp()::text), order_no, lead_id, 'leopards_status',
       'Leopards: ' || courier_status, 'LEOPARDS', 'Leopards', '{"backfilled": true}'::jsonb, courier_at
FROM bf_orders WHERE courier_at IS NOT NULL AND courier_status IS NOT NULL;

INSERT INTO "OrderLog" ("id", "orderNo", "saleId", "action", "message", "source", "actor", "details", "createdAt")
SELECT 'bf_' || md5(random()::text || clock_timestamp()::text), m."orderNo", NULL,
       CASE WHEN m."status" = 'FAILED' THEN 'whatsapp_failed' ELSE 'whatsapp_sent' END,
       'WhatsApp ' ||
         CASE m."kind"::text
           WHEN 'ORDER_CONFIRM' THEN '"confirm your order" message'
           WHEN 'DISPATCHED' THEN '"order dispatched" message'
           WHEN 'DELIVERED' THEN '"order delivered" message'
           WHEN 'BILL' THEN 'bill'
           WHEN 'REPLY_ACK' THEN 'thank-you reply'
           WHEN 'ANSWER_LOCKED' THEN '"answer already given" reply'
           ELSE 'message'
         END ||
         CASE WHEN m."status" = 'FAILED' THEN ' failed' || COALESCE(': ' || LEFT(m."error", 120), '') ELSE ' sent' END,
       'WHATSAPP', 'WhatsApp', '{"backfilled": true}'::jsonb, COALESCE(m."sentAt", m."updatedAt")
FROM "WhatsAppMessage" m
WHERE m."status" IN ('SENT', 'FAILED');

DROP TABLE bf_orders;
