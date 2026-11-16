-- WhatsApp on / off per order source
ALTER TABLE "OrderSource" ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Marketplaces that forbid contacting their customers outside the platform start switched off
UPDATE "OrderSource" SET "whatsappEnabled" = false WHERE LOWER("name") LIKE '%daraz%';

-- App-wide switches (the master WhatsApp on / off)
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
