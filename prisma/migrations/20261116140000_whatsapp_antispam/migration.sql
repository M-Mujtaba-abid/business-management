-- Several wordings per message (one is picked at random for each send)
ALTER TABLE "WhatsAppTemplate" ADD COLUMN "variants" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "WhatsAppTemplate" ADD COLUMN "lastVariant" INTEGER NOT NULL DEFAULT -1;

-- When a message held back by quiet hours / the daily limit will go out
ALTER TABLE "WhatsAppMessage" ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- Customers who replied STOP
CREATE TABLE "WhatsAppOptOut" (
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppOptOut_pkey" PRIMARY KEY ("phone")
);
