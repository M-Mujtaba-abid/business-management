-- Editable message templates
CREATE TABLE "WhatsAppTemplate" (
    "key" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("key")
);

-- Customer conversations
CREATE TYPE "ChatDirection" AS ENUM ('IN', 'OUT');

CREATE TABLE "WhatsAppChat" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "direction" "ChatDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "orderNo" INTEGER,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "waMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppChat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppChat_waMessageId_key" ON "WhatsAppChat"("waMessageId");
CREATE INDEX "WhatsAppChat_phone_createdAt_idx" ON "WhatsAppChat"("phone", "createdAt");

-- Messages already sent before chats were saved
INSERT INTO "WhatsAppChat" ("id", "phone", "direction", "body", "orderNo", "waMessageId", "createdAt")
SELECT 'bf_' || "id", "phone", 'OUT', "body", "orderNo", "waMessageId", COALESCE("sentAt", "createdAt")
FROM "WhatsAppMessage"
WHERE "status" = 'SENT';
