-- CreateTable
CREATE TABLE "OrderImage" (
    "id" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderImage_orderNo_idx" ON "OrderImage"("orderNo");

