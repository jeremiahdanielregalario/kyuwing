-- Pairings a queue master rejected with Regenerate, remembered on the replacement game.
ALTER TABLE "Match" ADD COLUMN "rejected" TEXT[] DEFAULT ARRAY[]::TEXT[];
