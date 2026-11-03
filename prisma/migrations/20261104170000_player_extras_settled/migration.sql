-- Extra charges per player (grips, other) and a settled flag (paid + change given).
ALTER TABLE "SessionPlayer" ADD COLUMN "gripCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SessionPlayer" ADD COLUMN "otherCharge" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SessionPlayer" ADD COLUMN "otherNote" TEXT;
ALTER TABLE "SessionPlayer" ADD COLUMN "settled" BOOLEAN NOT NULL DEFAULT false;
-- Players already paid in full before this change count as settled.
UPDATE "SessionPlayer" SET "settled" = true WHERE "paid" = true;
