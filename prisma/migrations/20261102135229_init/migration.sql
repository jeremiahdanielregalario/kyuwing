-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('E_MINUS', 'E', 'E_PLUS', 'DE', 'D_MINUS', 'D', 'D_PLUS', 'CD', 'C_MINUS', 'C', 'C_PLUS', 'BC', 'B_MINUS', 'B', 'B_PLUS', 'AB', 'A_MINUS', 'A', 'A_PLUS');

-- CreateEnum
CREATE TYPE "PlayerCategory" AS ENUM ('ACTIVE', 'ALUMNI', 'APPLICANT');

-- CreateEnum
CREATE TYPE "GameDayType" AS ENUM ('REGULAR', 'TIPID', 'MEGA');

-- CreateEnum
CREATE TYPE "GameDayStatus" AS ENUM ('DRAFT', 'LIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SessionPlayerStatus" AS ENUM ('EXPECTED', 'WAITING', 'PLAYING', 'DONE');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SUGGESTED', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PairingRequestType" AS ENUM ('PAIR_WITH', 'PLAY_AGAINST');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'GCASH', 'BANK', 'OTHER');

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "defaultStart" TEXT NOT NULL DEFAULT '10:00',
    "defaultEnd" TEXT NOT NULL DEFAULT '14:00',
    "defaultCourts" INTEGER NOT NULL DEFAULT 3,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRule" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "dayType" "GameDayType" NOT NULL DEFAULT 'REGULAR',
    "category" "PlayerCategory" NOT NULL,
    "flatFee" INTEGER NOT NULL,
    "perGameFee" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "fullName" TEXT,
    "level" "SkillLevel" NOT NULL,
    "category" "PlayerCategory" NOT NULL DEFAULT 'ACTIVE',
    "contact" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameDay" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "GameDayType" NOT NULL DEFAULT 'REGULAR',
    "status" "GameDayStatus" NOT NULL DEFAULT 'DRAFT',
    "targetScore" INTEGER NOT NULL DEFAULT 35,
    "courtPlan" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPlayer" (
    "id" TEXT NOT NULL,
    "gameDayId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "SessionPlayerStatus" NOT NULL DEFAULT 'EXPECTED',
    "joinedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "lastPlayedAt" TIMESTAMP(3),
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "permanentPartnerId" TEXT,
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "gameDayId" TEXT NOT NULL,
    "courtNumber" INTEGER NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "status" "MatchStatus" NOT NULL DEFAULT 'SUGGESTED',
    "score1" INTEGER,
    "score2" INTEGER,
    "note" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "team" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairingRequest" (
    "id" TEXT NOT NULL,
    "gameDayId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" "PairingRequestType" NOT NULL,
    "targetPlayerId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_shortName_key" ON "Venue"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRule_venueId_dayType_category_key" ON "FeeRule"("venueId", "dayType", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Player_nickname_key" ON "Player"("nickname");

-- CreateIndex
CREATE INDEX "Player_level_idx" ON "Player"("level");

-- CreateIndex
CREATE INDEX "Player_active_idx" ON "Player"("active");

-- CreateIndex
CREATE INDEX "GameDay_date_idx" ON "GameDay"("date");

-- CreateIndex
CREATE INDEX "GameDay_status_idx" ON "GameDay"("status");

-- CreateIndex
CREATE INDEX "SessionPlayer_gameDayId_status_idx" ON "SessionPlayer"("gameDayId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionPlayer_gameDayId_playerId_key" ON "SessionPlayer"("gameDayId", "playerId");

-- CreateIndex
CREATE INDEX "Match_gameDayId_status_idx" ON "Match"("gameDayId", "status");

-- CreateIndex
CREATE INDEX "MatchPlayer_playerId_idx" ON "MatchPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_matchId_playerId_key" ON "MatchPlayer"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "PairingRequest_gameDayId_idx" ON "PairingRequest"("gameDayId");

-- CreateIndex
CREATE UNIQUE INDEX "PairingRequest_gameDayId_playerId_type_targetPlayerId_key" ON "PairingRequest"("gameDayId", "playerId", "type", "targetPlayerId");

-- AddForeignKey
ALTER TABLE "FeeRule" ADD CONSTRAINT "FeeRule_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameDay" ADD CONSTRAINT "GameDay_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_gameDayId_fkey" FOREIGN KEY ("gameDayId") REFERENCES "GameDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_gameDayId_fkey" FOREIGN KEY ("gameDayId") REFERENCES "GameDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingRequest" ADD CONSTRAINT "PairingRequest_gameDayId_fkey" FOREIGN KEY ("gameDayId") REFERENCES "GameDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingRequest" ADD CONSTRAINT "PairingRequest_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingRequest" ADD CONSTRAINT "PairingRequest_targetPlayerId_fkey" FOREIGN KEY ("targetPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
