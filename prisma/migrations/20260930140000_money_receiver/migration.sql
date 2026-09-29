-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "receivedById" TEXT;

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_name_key" ON "Person"("name");

-- CreateIndex
CREATE INDEX "Sale_receivedById_idx" ON "Sale"("receivedById");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Default people who receive order money
INSERT INTO "Person" ("id", "name") VALUES
  ('person_mujtaba', 'Mujtaba'),
  ('person_noman', 'Noman')
ON CONFLICT ("name") DO NOTHING;
