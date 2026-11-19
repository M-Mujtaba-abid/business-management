-- Changing a password logs that user out everywhere
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;
