-- An ended game day logs its checked-in players as an attendance list, linked here so ending it
-- again (after a reopen) updates the same list. Lists pasted from the chat have no game day.

-- AlterTable
ALTER TABLE "AttendanceEvent" ADD COLUMN "gameDayId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_gameDayId_key" ON "AttendanceEvent"("gameDayId");

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_gameDayId_fkey" FOREIGN KEY ("gameDayId") REFERENCES "GameDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
