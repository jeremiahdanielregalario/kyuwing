-- Free games (used shuttle near the end of the reservation) don't count as games played.
ALTER TABLE "Match" ADD COLUMN "free" BOOLEAN NOT NULL DEFAULT false;
