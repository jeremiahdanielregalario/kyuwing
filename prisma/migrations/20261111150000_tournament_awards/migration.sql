-- Past tournament podiums (champions and runners-up per division), shown in the player database.
-- CreateEnum
CREATE TYPE "AwardPlace" AS ENUM ('CHAMPION', 'RUNNER_UP');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentAward" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "place" "AwardPlace" NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TournamentAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tournament_date_idx" ON "Tournament"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_name_date_key" ON "Tournament"("name", "date");

-- CreateIndex
CREATE INDEX "TournamentAward_tournamentId_idx" ON "TournamentAward"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentAward_player1Id_idx" ON "TournamentAward"("player1Id");

-- CreateIndex
CREATE INDEX "TournamentAward_player2Id_idx" ON "TournamentAward"("player2Id");

-- AddForeignKey
ALTER TABLE "TournamentAward" ADD CONSTRAINT "TournamentAward_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAward" ADD CONSTRAINT "TournamentAward_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAward" ADD CONSTRAINT "TournamentAward_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

