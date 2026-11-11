-- Podium teams of any size (doubles pairs, or whole teams for team-format tournaments like the League Cup).
-- Existing player1/player2 awards are copied into the new table before the old columns are dropped.

-- CreateTable
CREATE TABLE "TournamentAwardPlayer" (
    "id" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TournamentAwardPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentAwardPlayer_playerId_idx" ON "TournamentAwardPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentAwardPlayer_awardId_playerId_key" ON "TournamentAwardPlayer"("awardId", "playerId");

-- AddForeignKey
ALTER TABLE "TournamentAwardPlayer" ADD CONSTRAINT "TournamentAwardPlayer_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "TournamentAward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAwardPlayer" ADD CONSTRAINT "TournamentAwardPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CopyData
INSERT INTO "TournamentAwardPlayer" ("id", "awardId", "playerId", "position")
SELECT "id" || '_p1', "id", "player1Id", 0 FROM "TournamentAward";

-- CopyData
INSERT INTO "TournamentAwardPlayer" ("id", "awardId", "playerId", "position")
SELECT "id" || '_p2', "id", "player2Id", 1 FROM "TournamentAward"
WHERE "player2Id" IS NOT NULL AND "player2Id" <> "player1Id";

-- DropForeignKey
ALTER TABLE "TournamentAward" DROP CONSTRAINT "TournamentAward_player1Id_fkey";

-- DropForeignKey
ALTER TABLE "TournamentAward" DROP CONSTRAINT "TournamentAward_player2Id_fkey";

-- DropIndex
DROP INDEX "TournamentAward_player1Id_idx";

-- DropIndex
DROP INDEX "TournamentAward_player2Id_idx";

-- AlterTable
ALTER TABLE "TournamentAward" DROP COLUMN "player1Id",
DROP COLUMN "player2Id";
