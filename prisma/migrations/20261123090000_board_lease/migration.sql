-- The device holding each game day's board (see lib/board-lease.ts).
CREATE TABLE "BoardLease" (
    "gameDayId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "epoch" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "device" TEXT,

    CONSTRAINT "BoardLease_pkey" PRIMARY KEY ("gameDayId")
);

ALTER TABLE "BoardLease" ADD CONSTRAINT "BoardLease_gameDayId_fkey" FOREIGN KEY ("gameDayId") REFERENCES "GameDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
