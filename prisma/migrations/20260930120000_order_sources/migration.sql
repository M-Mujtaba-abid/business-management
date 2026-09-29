-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "orderSourceId" TEXT;

-- CreateTable
CREATE TABLE "OrderSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderSource_name_key" ON "OrderSource"("name");

-- CreateIndex
CREATE INDEX "Sale_orderSourceId_idx" ON "Sale"("orderSourceId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_orderSourceId_fkey" FOREIGN KEY ("orderSourceId") REFERENCES "OrderSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Default order sources
INSERT INTO "OrderSource" ("id", "name") VALUES
  ('osrc_daraz', 'Daraz'),
  ('osrc_website', 'Website'),
  ('osrc_olx', 'OLX'),
  ('osrc_marketplace', 'Marketplace')
ON CONFLICT ("name") DO NOTHING;
