"use server";

import { revalidatePath } from "next/cache";
import { fail, ok } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { aliasIndex } from "@/lib/aliases";
import { fullNameKeys, nameKey, parseAttendanceBlock, parseNameList } from "@/lib/attendance";
import { isQueueMaster } from "@/lib/auth";
import { dateOnlyFromKey } from "@/lib/datetime";
import { prisma } from "@/lib/db";

async function guard() {
  if (!(await isQueueMaster())) return fail("Your queue-master session expired. Sign in again.");
  return null;
}

export type AttendanceImportSummary = {
  eventId: string;
  played: number;
  waitlist: number;
  unmatched: string[];
};

export type AttendanceEventInput = {
  /** Set when editing a logged list: its date, type, label and players are replaced. */
  id?: string;
  date: string;
  kind: "GAMEDAY" | "TOURNAMENT";
  label?: string;
  playedText: string;
  waitlistText: string;
};

export async function logAttendanceEvent(
  input: AttendanceEventInput,
): Promise<ActionResult<AttendanceImportSummary>> {
  const authError = await guard();
  if (authError) return authError;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return fail("Pick a valid date.");

  const players = await prisma.player.findMany({
    select: { id: true, nickname: true, fullName: true, aliases: true },
  });
  const byAlias = aliasIndex(players.map((player) => ({ aliases: player.aliases, value: player.id })));
  const nicknames = new Set([...players.map((player) => nameKey(player.nickname)), ...byAlias.keys()]);
  const isKnown = (key: string) => nicknames.has(key);

  // The played box may hold a whole chat message, including its own "Waitlist:" section.
  const pasted = parseAttendanceBlock(input.playedText, isKnown);
  const played = pasted.played;
  const waitlist = [...pasted.waitlist, ...parseNameList(input.waitlistText, isKnown)];

  if (played.length === 0 && waitlist.length === 0) {
    return fail("Paste at least one nickname into the played or waitlist list.");
  }

  // Chat lists use nicknames, so a nickname always wins over a full name, and a
  // full name shared by two players is too ambiguous to match on.
  const byKey = new Map<string, string>();
  const fullNameCounts = new Map<string, number>();
  for (const player of players) {
    if (!player.fullName) continue;
    for (const key of fullNameKeys(player.fullName)) {
      fullNameCounts.set(key, (fullNameCounts.get(key) ?? 0) + 1);
    }
  }
  for (const player of players) {
    if (!player.fullName) continue;
    for (const key of fullNameKeys(player.fullName)) {
      if (fullNameCounts.get(key) === 1) byKey.set(key, player.id);
    }
  }
  for (const [key, id] of byAlias) byKey.set(key, id);
  for (const player of players) byKey.set(nameKey(player.nickname), player.id);

  const playedIds = new Map<string, "PLAYED" | "WAITLIST">();
  const unmatched: string[] = [];

  const match = (name: string) => {
    const id = byKey.get(nameKey(name));
    if (!id) unmatched.push(name);
    return id;
  };

  for (const name of played) {
    const id = match(name);
    if (id) playedIds.set(id, "PLAYED");
  }
  for (const name of waitlist) {
    const id = match(name);
    if (id && !playedIds.has(id)) playedIds.set(id, "WAITLIST");
  }

  if (playedIds.size === 0) {
    return fail(
      `None of those nicknames are in the database yet. Add them first, then log the list. Unmatched: ${unmatched
        .slice(0, 8)
        .join(", ")}${unmatched.length > 8 ? "…" : ""}`,
    );
  }

  const fields = {
    date: dateOnlyFromKey(input.date),
    kind: input.kind,
    label: input.label?.trim() || null,
  };
  const entries = [...playedIds].map(([playerId, status]) => ({ playerId, status }));

  try {
    let event: { id: string };
    if (input.id) {
      const editId = input.id;
      const found = await prisma.attendanceEvent.findUnique({ where: { id: editId }, select: { id: true } });
      if (!found) return fail("That attendance list was removed. Refresh the page.");
      event = await prisma.$transaction(async (tx) => {
        await tx.attendanceEntry.deleteMany({ where: { eventId: editId } });
        await tx.attendanceEntry.createMany({
          data: entries.map((entry) => ({ ...entry, eventId: editId })),
        });
        return tx.attendanceEvent.update({ where: { id: editId }, data: fields, select: { id: true } });
      });
    } else {
      event = await prisma.attendanceEvent.create({
        data: { ...fields, entries: { create: entries } },
        select: { id: true },
      });
    }

    revalidatePath("/app/players");
    const playedCount = [...playedIds.values()].filter((status) => status === "PLAYED").length;
    const waitlistCount = playedIds.size - playedCount;
    return ok(`${input.id ? "Updated" : "Logged"}: ${playedCount} played and ${waitlistCount} waitlisted.`, {
      eventId: event.id,
      played: playedCount,
      waitlist: waitlistCount,
      unmatched,
    });
  } catch (error) {
    console.error(error);
    return fail("Could not save the attendance list.");
  }
}

export async function deleteAttendanceEvent(id: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  try {
    await prisma.attendanceEvent.delete({ where: { id } });
    revalidatePath("/app/players");
    return ok("Attendance list removed.");
  } catch (error) {
    console.error(error);
    return fail("Could not remove that attendance list.");
  }
}
