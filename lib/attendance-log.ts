import "server-only";

import type { Prisma } from "@prisma/client";
import { syncGameDayAttendance } from "@/lib/attendance";

/**
 * Logs an ended game day on the attendance lists (Players → Logged lists), so recency and each
 * player's history follow without pasting the chat list. Everyone who checked in is logged as
 * played. The list is linked to the game day, so ending it again after a reopen updates the same
 * list. When a list for that date was already pasted from the chat (and isn't linked to another
 * game day), that list is used, keeping its waitlist. Returns how many played.
 */
export async function logAttendanceFromGameDay(
  tx: Prisma.TransactionClient,
  gameDayId: string,
): Promise<number> {
  const gameDay = await tx.gameDay.findUnique({
    where: { id: gameDayId },
    select: {
      name: true,
      date: true,
      attendance: { select: { id: true } },
      players: { select: { playerId: true, status: true } },
    },
  });
  if (!gameDay) return 0;
  const session = gameDay.players.map((row) => ({
    playerId: row.playerId,
    checkedIn: row.status !== "EXPECTED",
  }));
  const played = session.filter((row) => row.checkedIn).length;

  let eventId = gameDay.attendance?.id;
  if (!eventId) {
    const pasted = await tx.attendanceEvent.findMany({
      where: { date: gameDay.date, kind: "GAMEDAY", gameDayId: null },
      select: { id: true },
    });
    if (pasted.length === 1) {
      eventId = pasted[0].id;
      await tx.attendanceEvent.update({ where: { id: eventId }, data: { gameDayId } });
    } else {
      if (played === 0) return 0;
      eventId = (
        await tx.attendanceEvent.create({
          data: { date: gameDay.date, kind: "GAMEDAY", label: gameDay.name, gameDayId },
          select: { id: true },
        })
      ).id;
    }
  }

  const existing = await tx.attendanceEntry.findMany({
    where: { eventId },
    select: { playerId: true, status: true },
  });
  const change = syncGameDayAttendance(existing, session);
  if (change.remove.length > 0) {
    await tx.attendanceEntry.deleteMany({ where: { eventId, playerId: { in: change.remove } } });
  }
  if (change.upsertPlayed.length > 0) {
    await tx.attendanceEntry.updateMany({
      where: { eventId, playerId: { in: change.upsertPlayed } },
      data: { status: "PLAYED" },
    });
    await tx.attendanceEntry.createMany({
      data: change.upsertPlayed.map((playerId) => ({ eventId, playerId, status: "PLAYED" as const })),
      skipDuplicates: true,
    });
  }
  return played;
}
