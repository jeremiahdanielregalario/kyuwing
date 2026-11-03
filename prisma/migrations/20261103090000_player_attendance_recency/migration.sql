-- Attendance history imported from game-day and tournament chat lists.
-- Powers the player recency score on the Players page.

CREATE TYPE "AttendanceKind" AS ENUM ('GAMEDAY', 'TOURNAMENT');
CREATE TYPE "AttendanceStatus" AS ENUM ('PLAYED', 'WAITLIST');

CREATE TABLE "AttendanceEvent" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT,
    "kind" "AttendanceKind" NOT NULL DEFAULT 'GAMEDAY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PLAYED',

    CONSTRAINT "AttendanceEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendanceEvent_date_idx" ON "AttendanceEvent"("date");
CREATE UNIQUE INDEX "AttendanceEntry_eventId_playerId_key" ON "AttendanceEntry"("eventId", "playerId");
CREATE INDEX "AttendanceEntry_playerId_idx" ON "AttendanceEntry"("playerId");

ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AttendanceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
