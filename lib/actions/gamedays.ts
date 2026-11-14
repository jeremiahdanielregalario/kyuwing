"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { fail, ok } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { isQueueMaster } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  courtName,
  currentSlotIndex,
  dateOnlyFromKey,
  extendedPlan,
  elapsedMinutes,
  formatClock,
  formatGameDate,
  openCourts,
  parseCourtPlan,
  normalizeCourtLabel,
  QUEUED_COURT,
  renamedCourt,
  withoutCourt,
} from "@/lib/datetime";
import { syncGameDayAttendance } from "@/lib/attendance";
import { canUndoCheckIn } from "@/lib/check-in";
import { addCourtForWindow, formatTime12, planProblem, planWindow } from "@/lib/court-plan";
import { applyCourtSetup, type CourtSetup } from "@/lib/court-setup";
import { buildFeeSchedule, changeDue, extrasTotal, formatPeso } from "@/lib/fees";
import { isUnrated, levelLabel, parseLevel } from "@/lib/levels";
import {
  GAME_MINUTES,
  isFreeBy,
  lineTimes,
  moveInLine,
  planTimeline,
  playerAvailableAt,
} from "@/lib/planning";
import { checkSignup, notReadyReason } from "@/lib/signup-check";
import { arrangementKey, suggestMatches, type PairingHistoryMatch, type PairingPlayer } from "@/lib/pairing";
import {
  addCourtSchema,
  chargesSchema,
  courtSetupSchema,
  gameDayCreateSchema,
  gameDayUpdateSchema,
  parseCategory,
  type PlayerInput,
} from "@/lib/validation";

async function guard() {
  if (!(await isQueueMaster())) return fail("Your queue-master session expired. Sign in again.");
  return null;
}

function refreshGameDay(id: string) {
  revalidatePath("/app");
  revalidatePath("/app/gamedays");
  revalidatePath(`/app/gamedays/${id}`);
  revalidatePath(`/app/gamedays/${id}/signups`);
  revalidatePath(`/app/gamedays/${id}/fees`);
  revalidatePath(`/app/gamedays/${id}/reports`);
  revalidatePath(`/app/gamedays/${id}/settings`);
}

/**
 * Display names for a game day's courts in its current block ("Court 5" when
 * the block's courts are labelled 5-8, "Next up" for the waiting line), so
 * messages match what the queue master sees on the board.
 */
async function courtNamer(gameDayId: string): Promise<(court: number) => string> {
  const gameDay = await prisma.gameDay.findUnique({ where: { id: gameDayId }, select: { courtPlan: true } });
  const plan = parseCourtPlan(gameDay?.courtPlan ?? []);
  const slot = plan.length ? plan[currentSlotIndex(plan)] : undefined;
  return (court) => courtName(slot, court);
}

/**
 * Move queued games onto open courts in the current block, oldest first.
 * `preferCourt` (a court that just freed up) is filled before the others.
 * Returns the courts that received a game.
 */
async function promoteQueuedGames(
  tx: Prisma.TransactionClient,
  gameDayId: string,
  preferCourt?: number,
  slotIndex?: number,
): Promise<number[]> {
  const waitingLine = await tx.match.findMany({
    where: { gameDayId, status: "SUGGESTED", courtNumber: QUEUED_COURT },
    orderBy: { createdAt: "asc" },
    select: { id: true, players: { select: { playerId: true } } },
  });
  if (waitingLine.length === 0) return [];

  // A planned game can include players still on court. Only games whose four are
  // all free move onto a court; the rest keep waiting for their turn.
  const playing = await tx.matchPlayer.findMany({
    where: { match: { gameDayId, status: "LIVE" } },
    select: { playerId: true },
  });
  const playingIds = new Set(playing.map((row) => row.playerId));
  const queued = waitingLine.filter((game) => !game.players.some((row) => playingIds.has(row.playerId)));
  if (queued.length === 0) return [];

  const gameDay = await tx.gameDay.findUnique({ where: { id: gameDayId }, select: { courtPlan: true } });
  const plan = parseCourtPlan(gameDay?.courtPlan ?? []);
  if (plan.length === 0) return [];
  const total = (plan[slotIndex ?? -1] ?? plan[currentSlotIndex(plan)]).courts;

  const busy = await tx.match.findMany({
    where: { gameDayId, status: { in: ["SUGGESTED", "LIVE"] }, courtNumber: { not: QUEUED_COURT } },
    select: { courtNumber: true },
  });
  const open = openCourts(
    total,
    busy.map((match) => match.courtNumber),
  );
  if (preferCourt !== undefined && open.includes(preferCourt)) {
    open.splice(open.indexOf(preferCourt), 1);
    open.unshift(preferCourt);
  }

  const filled: number[] = [];
  for (const [index, match] of queued.entries()) {
    const court = open[index];
    if (court === undefined) break;
    await tx.match.update({ where: { id: match.id }, data: { courtNumber: court } });
    filled.push(court);
  }
  return filled;
}

function validateCourtPlan(plan: Array<{ start: string; end: string }>) {
  return planProblem(plan);
}

export async function createGameDay(input: unknown): Promise<ActionResult<{ id: string }>> {
  const authError = await guard();
  if (authError) return authError;

  const parsed = gameDayCreateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the game day details.");
  const planError = validateCourtPlan(parsed.data.courtPlan);
  if (planError) return fail(planError);

  const venue = await prisma.venue.findUnique({ where: { id: parsed.data.venueId } });
  if (!venue) return fail("Pick a venue.");

  // A pasted Messenger list: nothing is created unless every name is an official nickname.
  let playerIds: string[] = [];
  let listQueueMaster: string | null = null;
  let listFinance: string | null = null;
  if (parsed.data.signupText?.trim()) {
    const check = await checkSignup(parsed.data.signupText);
    if (!check.ready) return fail(notReadyReason(check));
    const confirmed = check.lines.filter((line) => !line.waitlist);
    const nicknames = [...new Set(confirmed.map((line) => line.nickname!))];
    const found = await prisma.player.findMany({
      where: { nickname: { in: nicknames } },
      select: { id: true },
    });
    playerIds = found.map((player) => player.id);
    listQueueMaster = confirmed.find((line) => line.role === "QM")?.nickname ?? null;
    listFinance = confirmed.find((line) => line.role === "FIN")?.nickname ?? null;
  }

  const date = dateOnlyFromKey(parsed.data.date);
  const fallbackName = `${venue.shortName} · ${formatGameDate(date, { weekday: true, year: false })}`;
  const gameDay = await prisma.gameDay.create({
    data: {
      name: parsed.data.name?.trim() || fallbackName,
      venueId: venue.id,
      date,
      type: parsed.data.type,
      courtPlan: parsed.data.courtPlan,
      notes: parsed.data.notes || null,
      queueMasterName: parsed.data.queueMasterName || listQueueMaster || null,
      financeMemberName: parsed.data.financeMemberName || listFinance || null,
      courtRatePerHour: parsed.data.courtRatePerHour ?? null,
      ...(playerIds.length
        ? { players: { create: playerIds.map((playerId) => ({ playerId, status: "EXPECTED" as const })) } }
        : {}),
    },
  });

  refreshGameDay(gameDay.id);
  return ok(
    playerIds.length
      ? `Game day created with ${playerIds.length} players from the list. Check them in as they arrive.`
      : "Game day created. Add your sign-ups next.",
    { id: gameDay.id },
  );
}

export async function updateGameDay(input: unknown): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const parsed = gameDayUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the game day details.");
  if (parsed.data.courtPlan) {
    const planError = validateCourtPlan(parsed.data.courtPlan);
    if (planError) return fail(planError);
  }

  const { id, date, ...rest } = parsed.data;
  await prisma.gameDay.update({
    where: { id },
    data: {
      ...(rest.name !== undefined ? { name: rest.name || "Game day" } : {}),
      ...(rest.type ? { type: rest.type } : {}),
      ...(rest.courtPlan ? { courtPlan: rest.courtPlan } : {}),
      ...(rest.notes !== undefined ? { notes: rest.notes || null } : {}),
      ...(rest.queueMasterName !== undefined ? { queueMasterName: rest.queueMasterName || null } : {}),
      ...(rest.financeMemberName !== undefined ? { financeMemberName: rest.financeMemberName || null } : {}),
      ...(rest.courtRatePerHour !== undefined ? { courtRatePerHour: rest.courtRatePerHour || null } : {}),
      ...(date ? { date: dateOnlyFromKey(date) } : {}),
      ...(rest.venueId ? { venueId: rest.venueId } : {}),
    },
  });

  refreshGameDay(id);
  return ok("Game day settings saved.");
}

export async function setGameDayStatus(
  id: string,
  status: "DRAFT" | "LIVE" | "COMPLETED",
): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  if (status === "COMPLETED") {
    const logged = await prisma.$transaction(async (tx) => {
      await tx.match.updateMany({
        where: { gameDayId: id, status: { in: ["SUGGESTED", "LIVE"] } },
        data: { status: "CANCELLED", endedAt: new Date() },
      });
      await tx.sessionPlayer.updateMany({
        where: { gameDayId: id, status: "PLAYING" },
        data: { status: "DONE", queuedAt: null },
      });
      await tx.gameDay.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      return logAttendanceFromGameDay(tx, id);
    });
    refreshGameDay(id);
    refreshAttendance();
    return ok(`Game day closed.${loggedText(logged)} Reports are ready to export.`);
  }

  await prisma.gameDay.update({
    where: { id },
    data: {
      status,
      startedAt: status === "LIVE" ? new Date() : undefined,
      completedAt: null,
    },
  });
  refreshGameDay(id);
  return ok(status === "LIVE" ? "Game day is live." : "Game day reopened as a draft.");
}

/**
 * Start a draft game day after the queue master confirmed the courts: how many were reserved
 * in each block and what the venue calls them. Suggested games on courts that no longer exist
 * go to the Next up line.
 */
export async function startGameDay(id: string, setup: CourtSetup[]): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const parsed = courtSetupSchema.safeParse(setup);
  if (!parsed.success) return fail("Check the courts: each block needs a court count and names.");

  const gameDay = await prisma.gameDay.findUnique({
    where: { id },
    select: { status: true, courtPlan: true },
  });
  if (!gameDay) return fail("Game day not found.");
  if (gameDay.status !== "DRAFT") return fail("This game day has already started.");

  const result = applyCourtSetup(parseCourtPlan(gameDay.courtPlan), parsed.data);
  if ("error" in result) return fail(result.error);
  const slotIndex = result.plan.length ? currentSlotIndex(result.plan) : undefined;
  const courtsNow = slotIndex === undefined ? 0 : result.plan[slotIndex].courts;

  await prisma.$transaction(async (tx) => {
    await tx.gameDay.update({
      where: { id },
      data: { courtPlan: result.plan, status: "LIVE", startedAt: new Date(), completedAt: null },
    });
    await tx.match.updateMany({
      where: { gameDayId: id, status: "SUGGESTED", courtNumber: { gt: courtsNow } },
      data: { courtNumber: QUEUED_COURT },
    });
    await promoteQueuedGames(tx, id, undefined, slotIndex);
  });

  refreshGameDay(id);
  return ok("Game day is live.");
}

/**
 * Extend a live game day past its reservation: adds a block from the current
 * end until `until` with `courts` courts. Suggested games on courts the
 * extension drops go to the waiting courts; waiting games fill added courts.
 */
export async function extendGameDay(gameDayId: string, until: string, courts: number): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const gameDay = await prisma.gameDay.findUnique({
    where: { id: gameDayId },
    select: { status: true, courtPlan: true },
  });
  if (!gameDay) return fail("Game day not found.");
  if (gameDay.status === "COMPLETED") return fail("This game day is already closed.");

  const result = extendedPlan(parseCourtPlan(gameDay.courtPlan), until, courts);
  if ("error" in result) return fail(result.error);

  await prisma.$transaction(async (tx) => {
    await tx.gameDay.update({ where: { id: gameDayId }, data: { courtPlan: result.plan } });
    await tx.match.updateMany({
      where: { gameDayId, status: "SUGGESTED", courtNumber: { gt: courts } },
      data: { courtNumber: QUEUED_COURT },
    });
    await promoteQueuedGames(tx, gameDayId, undefined, result.index);
  });

  refreshGameDay(gameDayId);
  return ok(`Extended until ${until} with ${courts} ${courts === 1 ? "court" : "courts"}.`);
}

/**
 * Close the game day at the end of the reservation. Games still on court can
 * be counted as played (they usually finished as time ran out); suggested and
 * waiting games are cancelled. Players then settle fees.
 */
/**
 * Logs an ended game day on the attendance lists (Players → Logged lists), so recency and each
 * player's history follow without pasting the chat list. Everyone who checked in is logged as
 * played. The list is linked to the game day, so ending it again after a reopen updates the same
 * list. When a list for that date was already pasted from the chat (and isn't linked to another
 * game day), that list is used, keeping its waitlist. Returns how many played.
 */
async function logAttendanceFromGameDay(tx: Prisma.TransactionClient, gameDayId: string): Promise<number> {
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

function loggedText(played: number): string {
  return played > 0 ? ` ${played} ${played === 1 ? "player" : "players"} logged in attendance.` : "";
}

/** Pages that show attendance: the Players page and the public roster. */
function refreshAttendance() {
  revalidatePath("/app/players");
  revalidatePath("/roster");
}

export async function endGameDay(gameDayId: string, countLiveGames: boolean): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const gameDay = await prisma.gameDay.findUnique({ where: { id: gameDayId }, select: { status: true } });
  if (!gameDay) return fail("Game day not found.");
  if (gameDay.status === "COMPLETED") return ok("This game day is already closed.");

  const live = await prisma.match.findMany({
    where: { gameDayId, status: "LIVE" },
    include: { players: { select: { playerId: true } } },
  });
  const now = new Date();

  const logged = await prisma.$transaction(async (tx) => {
    if (countLiveGames) {
      for (const match of live) {
        await tx.match.update({ where: { id: match.id }, data: { status: "COMPLETED", endedAt: now } });
        if (!match.free) {
          await tx.sessionPlayer.updateMany({
            where: { gameDayId, playerId: { in: match.players.map((row) => row.playerId) } },
            data: { gamesPlayed: { increment: 1 }, lastPlayedAt: now },
          });
        }
      }
    }
    await tx.match.updateMany({
      where: { gameDayId, status: { in: ["SUGGESTED", "LIVE"] } },
      data: { status: "CANCELLED", endedAt: now },
    });
    await tx.sessionPlayer.updateMany({
      where: { gameDayId, status: { in: ["PLAYING", "WAITING"] } },
      data: { status: "DONE", queuedAt: null },
    });
    await tx.gameDay.update({ where: { id: gameDayId }, data: { status: "COMPLETED", completedAt: now } });
    return logAttendanceFromGameDay(tx, gameDayId);
  });

  refreshGameDay(gameDayId);
  refreshAttendance();
  const counted =
    countLiveGames && live.length > 0
      ? ` ${live.length} game${live.length === 1 ? "" : "s"} in progress counted.`
      : "";
  return ok(`Game day ended.${counted}${loggedText(logged)} Collect fees next.`);
}

export async function deleteGameDay(id: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  await prisma.gameDay.delete({ where: { id } });
  revalidatePath("/app/gamedays");
  revalidatePath("/app");
  return ok("Game day deleted.");
}

export async function addPlayerToGameDay(
  gameDayId: string,
  playerId: string,
  checkInNow = false,
): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const [gameDay, player] = await Promise.all([
    prisma.gameDay.findUnique({ where: { id: gameDayId } }),
    prisma.player.findUnique({ where: { id: playerId } }),
  ]);
  if (!gameDay) return fail("Game day not found.");
  if (!player) return fail("Player not found.");

  const existing = await prisma.sessionPlayer.findUnique({
    where: { gameDayId_playerId: { gameDayId, playerId } },
  });
  if (existing) return fail(`${player.nickname} is already on the sign-up list.`);

  await prisma.sessionPlayer.create({
    data: {
      gameDayId,
      playerId,
      status: checkInNow ? "WAITING" : "EXPECTED",
      joinedAt: checkInNow ? new Date() : null,
      queuedAt: checkInNow ? new Date() : null,
    },
  });

  refreshGameDay(gameDayId);
  return ok(checkInNow ? `${player.nickname} checked in.` : `${player.nickname} added to sign-ups.`);
}

export async function addAllActivePlayers(gameDayId: string): Promise<ActionResult<{ added: number }>> {
  const authError = await guard();
  if (authError) return authError;

  const existing = await prisma.sessionPlayer.findMany({
    where: { gameDayId },
    select: { playerId: true },
  });
  const existingIds = new Set(existing.map((row) => row.playerId));
  const players = await prisma.player.findMany({ where: { active: true }, select: { id: true } });
  const toAdd = players.filter((player) => !existingIds.has(player.id));

  if (toAdd.length === 0) return ok("Every active player is already on the list.", { added: 0 });

  await prisma.sessionPlayer.createMany({
    data: toAdd.map((player) => ({ gameDayId, playerId: player.id, status: "EXPECTED" as const })),
    skipDuplicates: true,
  });

  refreshGameDay(gameDayId);
  return ok(`${toAdd.length} players added to sign-ups.`, { added: toAdd.length });
}

export async function addWalkIn(
  gameDayId: string,
  input: { nickname: string; level: string; category: string },
): Promise<ActionResult<{ sessionPlayerId: string }>> {
  const authError = await guard();
  if (authError) return authError;

  const nickname = input.nickname.trim();
  const level = parseLevel(input.level);
  const category = parseCategory(input.category);
  if (!nickname) return fail("Enter a nickname.");
  if (!level) return fail("Pick a valid level.");
  if (!category) return fail("Pick a valid player type.");

  let player = await prisma.player.findUnique({ where: { nickname } });
  if (!player) {
    player = await prisma.player.create({
      data: { nickname, level, category },
    });
  }

  const existing = await prisma.sessionPlayer.findUnique({
    where: { gameDayId_playerId: { gameDayId, playerId: player.id } },
  });
  if (existing) return fail(`${nickname} is already on this game day.`);

  const sessionPlayer = await prisma.sessionPlayer.create({
    data: {
      gameDayId,
      playerId: player.id,
      status: "WAITING",
      joinedAt: new Date(),
      queuedAt: new Date(),
    },
  });

  refreshGameDay(gameDayId);
  revalidatePath("/app/players");
  return ok(`${nickname} added as a walk-in.`, { sessionPlayerId: sessionPlayer.id });
}

export async function removePlayerFromGameDay(sessionPlayerId: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const row = await prisma.sessionPlayer.findUnique({ where: { id: sessionPlayerId } });
  if (!row) return fail("Sign-up not found.");
  if (row.status === "PLAYING") return fail("Finish the current game before removing this player.");

  await prisma.$transaction([
    prisma.sessionPlayer.updateMany({
      where: { gameDayId: row.gameDayId, permanentPartnerId: row.playerId },
      data: { permanentPartnerId: null },
    }),
    prisma.sessionPlayer.delete({ where: { id: sessionPlayerId } }),
  ]);

  refreshGameDay(row.gameDayId);
  return ok("Player removed from this game day.");
}

/**
 * Takes a check-in back, for a mistake: the player goes back to "expected" with no
 * queue time. Not for someone on court, done, who has played, or who is lined up
 * for a game, since those are not a plain mistake (see `canUndoCheckIn`).
 */
export async function undoCheckIn(sessionPlayerId: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const row = await prisma.sessionPlayer.findUnique({
    where: { id: sessionPlayerId },
    include: { player: true },
  });
  if (!row) return fail("Sign-up not found.");

  const lined = await prisma.match.findFirst({
    where: { gameDayId: row.gameDayId, status: "SUGGESTED", players: { some: { playerId: row.playerId } } },
    select: { courtNumber: true },
  });
  const name = await courtNamer(row.gameDayId);
  const verdict = canUndoCheckIn({
    nickname: row.player.nickname,
    status: row.status,
    gamesPlayed: row.gamesPlayed,
    linedUpFor: lined
      ? lined.courtNumber === QUEUED_COURT
        ? "a waiting game"
        : name(lined.courtNumber)
      : null,
  });
  if (!verdict.allow) return fail(verdict.reason);

  await prisma.$transaction([
    prisma.sessionPlayer.update({
      where: { id: sessionPlayerId },
      data: { status: "EXPECTED", joinedAt: null, queuedAt: null },
    }),
    // A pending "I'm leaving" request means nothing for someone who is not checked in.
    prisma.leaveRequest.deleteMany({ where: { sessionPlayerId, status: "PENDING" } }),
  ]);

  refreshGameDay(row.gameDayId);
  return ok(`${row.player.nickname}'s check-in was undone. They are back to expected.`);
}

export async function checkInPlayer(sessionPlayerId: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const row = await prisma.sessionPlayer.findUnique({
    where: { id: sessionPlayerId },
    include: { player: true },
  });
  if (!row) return fail("Sign-up not found.");
  if (row.status === "PLAYING") return fail("That player is already on court.");

  await prisma.sessionPlayer.update({
    where: { id: sessionPlayerId },
    data: {
      status: "WAITING",
      joinedAt: row.joinedAt ?? new Date(),
      queuedAt: new Date(),
    },
  });

  refreshGameDay(row.gameDayId);
  return ok(`${row.player.nickname} is in the queue.`);
}

/**
 * Confirms a player's "I'm leaving" request: marks them done and, if they were
 * lined up in a suggested game, removes that game so the other three go back to
 * waiting. A player in a live game cannot be confirmed until it finishes.
 */
export async function confirmLeaveRequest(requestId: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { sessionPlayer: { include: { player: true } } },
  });
  if (!request || request.status !== "PENDING") return fail("That request was already handled.");

  const row = request.sessionPlayer;
  const nickname = row.player.nickname;
  if (row.status === "PLAYING") {
    return fail(`${nickname} is in a live game. Finish it first, then confirm.`);
  }

  const lined = await prisma.match.findMany({
    where: {
      gameDayId: request.gameDayId,
      status: "SUGGESTED",
      players: { some: { playerId: row.playerId } },
    },
    select: { id: true },
  });
  await prisma.$transaction([
    ...(lined.length
      ? [prisma.match.deleteMany({ where: { id: { in: lined.map((match) => match.id) } } })]
      : []),
    prisma.sessionPlayer.update({ where: { id: row.id }, data: { status: "DONE", queuedAt: null } }),
    prisma.leaveRequest.updateMany({
      where: { sessionPlayerId: row.id, status: "PENDING" },
      data: { status: "CONFIRMED", resolvedAt: new Date() },
    }),
  ]);

  refreshGameDay(request.gameDayId);
  return ok(
    lined.length
      ? `${nickname} is out. Their suggested game was removed; the others are waiting again.`
      : `${nickname} is out for the day.`,
  );
}

export async function declineLeaveRequest(requestId: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { sessionPlayer: { include: { player: true } } },
  });
  if (!request || request.status !== "PENDING") return fail("That request was already handled.");

  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: { status: "DECLINED", resolvedAt: new Date() },
  });
  refreshGameDay(request.gameDayId);
  return ok(`${request.sessionPlayer.player.nickname} stays in the queue.`);
}

export async function markPlayerDone(sessionPlayerId: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const row = await prisma.sessionPlayer.findUnique({ where: { id: sessionPlayerId } });
  if (!row) return fail("Sign-up not found.");
  if (row.status === "PLAYING") return fail("Finish the current game before marking them done.");

  await prisma.sessionPlayer.update({
    where: { id: sessionPlayerId },
    data: { status: "DONE", queuedAt: null },
  });
  refreshGameDay(row.gameDayId);
  return ok("Marked done for the day.");
}

export async function requeuePlayer(sessionPlayerId: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const row = await prisma.sessionPlayer.findUnique({ where: { id: sessionPlayerId } });
  if (!row) return fail("Sign-up not found.");

  await prisma.sessionPlayer.update({
    where: { id: sessionPlayerId },
    data: { status: "WAITING", queuedAt: new Date(), joinedAt: row.joinedAt ?? new Date() },
  });
  refreshGameDay(row.gameDayId);
  return ok("Back in the queue.");
}

export async function togglePriority(sessionPlayerId: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const row = await prisma.sessionPlayer.findUnique({ where: { id: sessionPlayerId } });
  if (!row) return fail("Sign-up not found.");

  await prisma.sessionPlayer.update({
    where: { id: sessionPlayerId },
    data: { priority: !row.priority },
  });
  refreshGameDay(row.gameDayId);
  return ok(row.priority ? "Priority cleared." : "Marked as priority. They will be seated sooner.");
}

export async function setPermanentPartner(
  gameDayId: string,
  playerId: string,
  partnerId: string | null,
): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  if (partnerId === playerId) return fail("A player cannot partner with themselves.");

  const rows = await prisma.sessionPlayer.findMany({
    where: { gameDayId, playerId: { in: [playerId, ...(partnerId ? [partnerId] : [])] } },
  });
  if (rows.length !== (partnerId ? 2 : 1)) return fail("Both players must be on this game day.");

  await prisma.$transaction(async (tx) => {
    // Clear anyone who used to point at either player.
    await tx.sessionPlayer.updateMany({
      where: { gameDayId, permanentPartnerId: { in: [playerId, ...(partnerId ? [partnerId] : [])] } },
      data: { permanentPartnerId: null },
    });
    await tx.sessionPlayer.updateMany({
      where: { gameDayId, playerId: { in: [playerId, ...(partnerId ? [partnerId] : [])] } },
      data: { permanentPartnerId: null },
    });

    if (partnerId) {
      await tx.sessionPlayer.update({
        where: { gameDayId_playerId: { gameDayId, playerId } },
        data: { permanentPartnerId: partnerId },
      });
      await tx.sessionPlayer.update({
        where: { gameDayId_playerId: { gameDayId, playerId: partnerId } },
        data: { permanentPartnerId: playerId },
      });
    }
  });

  refreshGameDay(gameDayId);
  return ok(partnerId ? "Permanent pair saved." : "Permanent pair cleared.");
}

export async function createPairingRequest(
  gameDayId: string,
  playerId: string,
  type: "PAIR_WITH" | "PLAY_AGAINST",
  targetPlayerId: string,
): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  if (playerId === targetPlayerId) return fail("Pick a different player.");

  const rows = await prisma.sessionPlayer.findMany({
    where: { gameDayId, playerId: { in: [playerId, targetPlayerId] } },
  });
  if (rows.length !== 2) return fail("Both players must be on this game day.");

  await prisma.pairingRequest.upsert({
    where: {
      gameDayId_playerId_type_targetPlayerId: { gameDayId, playerId, type, targetPlayerId },
    },
    update: { active: true },
    create: { gameDayId, playerId, type, targetPlayerId },
  });

  refreshGameDay(gameDayId);
  return ok(type === "PAIR_WITH" ? "Partner request saved." : "Opponent request saved.");
}

export async function deletePairingRequest(id: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const row = await prisma.pairingRequest.findUnique({ where: { id } });
  if (!row) return fail("Request not found.");
  await prisma.pairingRequest.delete({ where: { id } });
  refreshGameDay(row.gameDayId);
  return ok("Request removed.");
}

export async function generateMatches(
  gameDayId: string,
  slotIndex?: number,
  maxMatches?: number,
  options: {
    queue?: boolean;
    /** Suggested games being regenerated: treated as free, avoided, and swapped out for the new ones. */
    replaceMatchIds?: string[];
    seed?: number;
    /** Fill this specific court (an open one) rather than the first free court. */
    courtNumber?: number;
    /**
     * Players the queue master already put on the court (1 to 3), with the side they were put
     * on. They stay on it, keeping partners and opponents, and the engine fills the rest.
     */
    seeds?: Array<{ playerId: string; team: 1 | 2 }>;
  } = {},
): Promise<ActionResult<{ matches: number }>> {
  const authError = await guard();
  if (authError) return authError;

  const gameDay = await prisma.gameDay.findUnique({
    where: { id: gameDayId },
    include: {
      players: { include: { player: true } },
      requests: { where: { active: true } },
      matches: { include: { players: true } },
    },
  });
  if (!gameDay) return fail("Game day not found.");
  if (gameDay.status === "COMPLETED") return fail("This game day is already closed.");

  const plan = parseCourtPlan(gameDay.courtPlan);
  if (plan.length === 0) return fail("Add at least one court block in Settings first.");
  const index =
    slotIndex !== undefined && slotIndex >= 0 && slotIndex < plan.length ? slotIndex : currentSlotIndex(plan);
  const slot = plan[index];

  const replacing = gameDay.matches.filter(
    (match) => match.status === "SUGGESTED" && options.replaceMatchIds?.includes(match.id),
  );
  const replacingIds = new Set(replacing.map((match) => match.id));
  if (options.replaceMatchIds && replacing.length === 0)
    return fail("Those suggestions are gone. Press Auto-pair for new ones.");

  const active = gameDay.matches.filter(
    (match) => (match.status === "SUGGESTED" || match.status === "LIVE") && !replacingIds.has(match.id),
  );
  const freeCourts = openCourts(
    slot.courts,
    active.map((match) => match.courtNumber),
  );

  // Games already waiting in the Next up line get open courts before anyone new is paired.
  if (
    !replacing.length &&
    !options.queue &&
    !options.seeds?.length &&
    freeCourts.length > 0 &&
    active.some((match) => match.courtNumber === QUEUED_COURT)
  ) {
    const filled = await prisma.$transaction((tx) => promoteQueuedGames(tx, gameDayId));
    if (filled.length > 0) {
      refreshGameDay(gameDayId);
      return ok(
        `${filled.length === 1 ? "Next up game" : `${filled.length} Next up games`} moved onto ${filled
          .map((court) => courtName(slot, court))
          .join(", ")}. Review and start.`,
        { matches: filled.length },
      );
    }
  }

  // With every court taken (or when the queue master pairs into the waiting
  // court), auto-pair builds the next game and puts it in line.
  const queueing = Boolean(options.queue) || freeCourts.length === 0;

  // A player queued for a suggested or live match is committed to that court —
  // never re-pair them, or the same foursome can end up on two courts at once.
  const busyPlayerIds = new Set(active.flatMap((match) => match.players.map((row) => row.playerId)));
  const uncommitted = gameDay.players.filter(
    (row) => row.status === "WAITING" && !busyPlayerIds.has(row.playerId),
  );

  // Planning ahead: when too few players are free, a waiting-court game can also use players who
  // are on court or in an earlier waiting game, as long as they are expected to be done by the
  // time this game would start. Nobody is on two playing courts at once; that is checked at Start.
  const nowMs = Date.now();
  const waitingLine = gameDay.matches
    .filter((match) => match.status === "SUGGESTED" && match.courtNumber === QUEUED_COURT)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const timeline = planTimeline({
    now: nowMs,
    totalCourts: slot.courts,
    busy: active
      .filter((match) => match.courtNumber !== QUEUED_COURT)
      .map((match) => ({
        courtNumber: match.courtNumber,
        startedAt: match.status === "LIVE" ? (match.startedAt?.getTime() ?? nowMs) : null,
      })),
    queuedGames: waitingLine.length,
  });
  // A replaced game keeps its turn; a new one goes to the end of the line.
  const replacedAt =
    replacing.length === 1 ? waitingLine.findIndex((match) => match.id === replacing[0].id) : -1;
  const gameStart = replacedAt >= 0 ? timeline.starts[replacedAt] : timeline.nextStart;

  const widened = queueing && uncommitted.length < 4;
  const planned = widened
    ? gameDay.players.filter((row) => {
        if (row.status !== "WAITING" && row.status !== "PLAYING") return false;
        const inGame = (match: (typeof gameDay.matches)[number]) =>
          match.players.some((entry) => entry.playerId === row.playerId);
        const live = active.find((match) => match.status === "LIVE" && inGame(match));
        const plannedStarts = [
          // Assigned to a court but not started: expected to start now.
          ...active
            .filter(
              (match) => match.status === "SUGGESTED" && match.courtNumber !== QUEUED_COURT && inGame(match),
            )
            .map(() => nowMs),
          ...waitingLine
            .filter((match) => !replacingIds.has(match.id) && inGame(match))
            .map((match) => timeline.starts[waitingLine.indexOf(match)]),
        ];
        return isFreeBy(
          playerAvailableAt({
            now: nowMs,
            liveStartedAt: live ? (live.startedAt?.getTime() ?? nowMs) : null,
            plannedStarts,
          }),
          gameStart,
        );
      })
    : uncommitted;
  const waiting = planned;

  if (waiting.length < 4) {
    return fail(
      widened
        ? `Not enough players will be free by about ${formatClock(new Date(gameStart))} to plan another game. ${waiting.length} of 4 so far. Check in more players, or plan it later.`
        : "At least four players need to be checked in and waiting.",
    );
  }

  // Players placed by hand: they must be able to play (waiting and free), and stay on the court.
  const seeds = options.seeds ?? [];
  if (seeds.length > 0) {
    if (replacing.length)
      return fail("Regenerate redoes a whole game. Clear the court first to place players by hand.");
    if (new Set(seeds.map((seed) => seed.playerId)).size !== seeds.length)
      return fail("A player can only be placed once.");
    if (seeds.length > 3) return fail("Four players already fill the court. Start it instead.");
    if (
      seeds.filter((seed) => seed.team === 1).length > 2 ||
      seeds.filter((seed) => seed.team === 2).length > 2
    )
      return fail("A team has only two places.");
    const available = new Set(waiting.map((row) => row.playerId));
    const unavailable = seeds.find((seed) => !available.has(seed.playerId));
    if (unavailable) {
      const who =
        gameDay.players.find((row) => row.playerId === unavailable.playerId)?.player.nickname ?? "A player";
      return fail(
        `${who} can't be placed right now. They need to be checked in and waiting, and not already in another game.`,
      );
    }
  }
  if (!queueing && options.courtNumber !== undefined && !freeCourts.includes(options.courtNumber)) {
    return fail(`${courtName(slot, options.courtNumber)} already has a game.`);
  }
  // Real courts to fill: the one asked for, or the free ones in order.
  const targetCourts = !queueing && options.courtNumber !== undefined ? [options.courtNumber] : freeCourts;

  const requestsByPlayer = new Map<string, PairingPlayer["requests"]>();
  for (const request of gameDay.requests) {
    const current = requestsByPlayer.get(request.playerId) ?? [];
    current.push({ type: request.type, targetPlayerId: request.targetPlayerId });
    requestsByPlayer.set(request.playerId, current);
  }

  const pairingPlayers: PairingPlayer[] = waiting.map((row) => ({
    id: row.playerId,
    nickname: row.player.nickname,
    level: row.player.level,
    // Someone still on court has not been waiting, whatever their old queue time says.
    waitMinutes: row.status === "WAITING" ? elapsedMinutes(row.queuedAt ?? row.joinedAt) : 0,
    gamesPlayed: row.gamesPlayed,
    priority: row.priority,
    permanentPartnerId: row.permanentPartnerId,
    requests: requestsByPlayer.get(row.playerId) ?? [],
  }));

  // Planned and live games count as history too when planning ahead, so the same four are not repeated.
  const history: PairingHistoryMatch[] = gameDay.matches
    .filter(
      (match) =>
        match.status === "COMPLETED" ||
        (widened && !replacingIds.has(match.id) && (match.status === "LIVE" || match.status === "SUGGESTED")),
    )
    .map((match) => ({
      round: match.round,
      playerIds: match.players.map((row) => row.playerId),
      team1: match.players.filter((row) => row.team === 1).map((row) => row.playerId),
      team2: match.players.filter((row) => row.team === 2).map((row) => row.playerId),
    }));

  const nextRound = Math.max(0, ...gameDay.matches.map((match) => match.round)) + 1;
  // Everything rejected so far for these games, plus the ones being replaced now.
  const rejected = [
    ...new Set(
      replacing.flatMap((match) => [
        ...match.rejected,
        arrangementKey(
          match.players.filter((row) => row.team === 1).map((row) => row.playerId),
          match.players.filter((row) => row.team === 2).map((row) => row.playerId),
        ),
      ]),
    ),
  ];
  const suggestions = suggestMatches(pairingPlayers, history, {
    courts: queueing ? 1 : Math.max(1, Math.min(targetCourts.length, maxMatches ?? targetCourts.length)),
    round: nextRound,
    scarcity: waiting.length < 10,
    // Planning ahead: everyone who is free right now plays first; players still on court only fill the gaps.
    // Players placed by hand are always in the game, on the sides they were put.
    mustInclude:
      seeds.length || widened
        ? [
            ...new Set([
              ...(widened ? uncommitted.map((row) => row.playerId) : []),
              ...seeds.map((seed) => seed.playerId),
            ]),
          ]
        : undefined,
    sides: seeds.length ? Object.fromEntries(seeds.map((seed) => [seed.playerId, seed.team])) : undefined,
    variety: replacing.length
      ? { seed: options.seed ?? Math.floor(Math.random() * 2 ** 31), avoid: rejected }
      : undefined,
  });

  const usedPlayerIds = new Set<string>();
  const disjointSuggestions = suggestions.filter((suggestion) => {
    const ids = suggestion.team1
      .map((player) => player.id)
      .concat(suggestion.team2.map((player) => player.id));
    if (ids.some((id) => usedPlayerIds.has(id))) return false;
    ids.forEach((id) => usedPlayerIds.add(id));
    return true;
  });

  if (disjointSuggestions.length === 0)
    return fail(
      replacing.length
        ? "There is no other fair arrangement with the players waiting. Edit the game by hand, or wait for more players."
        : "The pairing engine could not build a fair match from the current queue.",
    );

  // A replaced waiting game keeps its place in line.
  const keptCreatedAt = queueing && replacing.length === 1 ? replacing[0].createdAt : undefined;

  await prisma.$transaction([
    ...(replacing.length ? [prisma.match.deleteMany({ where: { id: { in: [...replacingIds] } } })] : []),
    ...disjointSuggestions.map((suggestion, index) =>
      prisma.match.create({
        data: {
          gameDayId,
          ...(keptCreatedAt ? { createdAt: keptCreatedAt } : {}),
          ...(replacing.length ? { rejected } : {}),
          courtNumber: queueing ? QUEUED_COURT : targetCourts[index],
          round: nextRound,
          status: "SUGGESTED",
          players: {
            create: [
              ...suggestion.team1.map((player, slotPosition) => ({
                playerId: player.id,
                team: 1,
                slot: slotPosition + 1,
              })),
              ...suggestion.team2.map((player, slotPosition) => ({
                playerId: player.id,
                team: 2,
                slot: slotPosition + 1,
              })),
            ],
          },
        },
      }),
    ),
  ]);

  refreshGameDay(gameDayId);
  if (replacing.length) {
    const where = queueing
      ? "in Next up"
      : `on ${targetCourts
          .slice(0, disjointSuggestions.length)
          .map((court) => courtName(slot, court))
          .join(", ")}`;
    return ok(
      `New ${disjointSuggestions.length === 1 ? "pairing" : "pairings"} ${where}. Not happy? Regenerate again.`,
      { matches: disjointSuggestions.length },
    );
  }
  if (queueing) {
    const inLine = active.filter((match) => match.courtNumber === QUEUED_COURT).length + 1;
    return ok(
      options.queue
        ? `Game set in the waiting court as #${inLine} — it takes the next free court.`
        : `All courts are busy. Game queued as #${inLine} in Next up — it takes the next free court.`,
      {
        matches: 1,
      },
    );
  }
  return ok(
    `${disjointSuggestions.length} ${disjointSuggestions.length === 1 ? "match" : "matches"} suggested on ${targetCourts
      .slice(0, disjointSuggestions.length)
      .map((court) => courtName(slot, court))
      .join(", ")}. Review and start.`,
    { matches: suggestions.length },
  );
}

/**
 * "I don't like these pairings": swaps suggested games for different ones.
 * With a `matchId`, only that game is redone (on a court or in Next up);
 * without, every suggestion on the courts is. Each press avoids the games it
 * is replacing, so repeated presses keep producing new arrangements, and
 * nothing is deleted unless a new arrangement exists.
 */
export async function regenerateMatches(
  gameDayId: string,
  slotIndex?: number,
  matchId?: string,
): Promise<ActionResult<{ matches: number }>> {
  const authError = await guard();
  if (authError) return authError;

  const targets = await prisma.match.findMany({
    where: matchId
      ? { id: matchId, gameDayId, status: "SUGGESTED" }
      : { gameDayId, status: "SUGGESTED", courtNumber: { not: QUEUED_COURT } },
    select: { id: true, courtNumber: true },
  });
  if (targets.length === 0)
    return fail("There are no suggested pairings to regenerate. Press Auto-pair first.");

  const queued = targets.length === 1 && targets[0].courtNumber === QUEUED_COURT;
  return generateMatches(gameDayId, slotIndex, targets.length, {
    queue: queued,
    replaceMatchIds: targets.map((match) => match.id),
  });
}

/** Moves a game in the waiting line to a new place (0 is next up). Others keep their order. */
export async function reorderQueuedGame(
  gameDayId: string,
  matchId: string,
  toIndex: number,
): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;
  if (!Number.isInteger(toIndex)) return fail("Pick a place in the line.");

  const line = await prisma.match.findMany({
    where: { gameDayId, status: "SUGGESTED", courtNumber: QUEUED_COURT },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, createdAt: true },
  });
  const next = moveInLine(
    line.map((match) => match.id),
    matchId,
    toIndex,
  );
  if (!line.some((match) => match.id === matchId)) return fail("That game is no longer in the waiting line.");
  if (!next) return ok("Already there.");

  const times = lineTimes(line.map((match) => match.createdAt.getTime()));
  await prisma.$transaction(
    next.map((id, index) =>
      prisma.match.update({ where: { id }, data: { createdAt: new Date(times[index]) } }),
    ),
  );

  refreshGameDay(gameDayId);
  return ok(
    next.indexOf(matchId) === 0 ? "Now up next." : `Moved to place ${next.indexOf(matchId) + 1} in line.`,
  );
}

export async function clearSuggestedMatches(gameDayId: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  // Games in the Next up line are cancelled one at a time, not cleared with the court suggestions.
  const result = await prisma.match.deleteMany({
    where: { gameDayId, status: "SUGGESTED", courtNumber: { not: QUEUED_COURT } },
  });
  refreshGameDay(gameDayId);
  return ok(result.count ? `${result.count} suggestions cleared.` : "No suggestions to clear.");
}

/** A game cannot start while one of its players is still level X (not rated yet). */
function unratedIn(matches: { players: { player: { nickname: string; level: string } }[] }[]) {
  const names = [
    ...new Set(
      matches.flatMap((match) =>
        match.players.filter((row) => isUnrated(row.player.level)).map((row) => row.player.nickname),
      ),
    ),
  ];
  if (names.length === 0) return null;
  return fail(
    `Set a level for ${names.join(", ")} before the game starts. X means their level is not known yet.`,
    "UNRATED_PLAYERS",
  );
}

export async function startMatch(matchId: string, options: { free?: boolean } = {}): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { players: { include: { player: true } } },
  });
  if (!match) return fail("Match not found.");
  const name = await courtNamer(match.gameDayId);
  if (match.status !== "SUGGESTED") return fail("This match is not waiting to start.");
  const unrated = unratedIn([match]);
  if (unrated) return unrated;

  let court = match.courtNumber;
  let noCourt = false;
  const clashed: string[] = [];
  await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction so two taps cannot start the same
    // four players on two courts.
    const others = await tx.match.findMany({
      where: {
        gameDayId: match.gameDayId,
        status: { in: ["SUGGESTED", "LIVE"] },
        id: { not: matchId },
      },
      include: { players: { include: { player: true } } },
    });
    // Planning ahead lets a player sit in several waiting or suggested games. The one
    // thing that cannot happen is being on two playing courts at once, so only a
    // live game blocks the start.
    const playingNow = new Map<string, { court: number; startedAt: Date | null }>();
    for (const other of others) {
      if (other.status !== "LIVE") continue;
      for (const row of other.players) {
        playingNow.set(row.playerId, { court: other.courtNumber, startedAt: other.startedAt });
      }
    }
    // Group by court: "Paolo and Rica are still playing on Court 5 (expected to finish about 3:23 AM)".
    const byCourt = new Map<number, { startedAt: Date | null; nicknames: string[] }>();
    for (const row of match.players) {
      const live = playingNow.get(row.playerId);
      if (!live) continue;
      const entry = byCourt.get(live.court) ?? { startedAt: live.startedAt, nicknames: [] };
      entry.nicknames.push(row.player.nickname);
      byCourt.set(live.court, entry);
    }
    for (const [liveCourt, entry] of byCourt) {
      const until = entry.startedAt
        ? ` (expected to finish about ${formatClock(new Date(entry.startedAt.getTime() + GAME_MINUTES * 60_000))})`
        : "";
      clashed.push(
        `${entry.nicknames.join(" and ")} ${entry.nicknames.length === 1 ? "is" : "are"} still playing on ${name(liveCourt)}${until}`,
      );
    }
    if (clashed.length > 0) return;

    if (court === QUEUED_COURT) {
      const gameDay = await tx.gameDay.findUnique({
        where: { id: match.gameDayId },
        select: { courtPlan: true },
      });
      const plan = parseCourtPlan(gameDay?.courtPlan ?? []);
      const total = plan.length ? plan[currentSlotIndex(plan)].courts : 0;
      const open = openCourts(
        total,
        others.map((other) => other.courtNumber),
      );
      if (open.length === 0) {
        noCourt = true;
        return;
      }
      court = open[0];
    }

    await tx.match.update({
      where: { id: matchId },
      data: { status: "LIVE", startedAt: new Date(), courtNumber: court, free: Boolean(options.free) },
    });
    await tx.sessionPlayer.updateMany({
      where: { gameDayId: match.gameDayId, playerId: { in: match.players.map((row) => row.playerId) } },
      data: { status: "PLAYING" },
    });
  });

  if (clashed.length > 0) {
    refreshGameDay(match.gameDayId);
    return fail(
      `${clashed.join("; ")}. Nobody can be on two playing courts at once. Re-pair this game with someone else, or wait for that game to finish.`,
      "PLAYER_STILL_PLAYING",
    );
  }
  if (noCourt) return fail("Every court is in use. This game starts when a court frees up.");

  refreshGameDay(match.gameDayId);
  return ok(options.free ? `${name(court)} is live — free game, not counted.` : `${name(court)} is live.`);
}

export async function startAllSuggested(
  gameDayId: string,
  options: { free?: boolean } = {},
): Promise<ActionResult<{ started: number }>> {
  const authError = await guard();
  if (authError) return authError;
  const name = await courtNamer(gameDayId);

  const matches = await prisma.match.findMany({
    where: { gameDayId, status: "SUGGESTED", courtNumber: { not: QUEUED_COURT } },
    include: { players: { include: { player: true } } },
  });
  if (matches.length === 0) return fail("There are no suggested matches on a court to start.");
  const unrated = unratedIn(matches);
  if (unrated) return unrated;

  // Guard against stale duplicate suggestions: one player cannot start twice.
  const live = await prisma.match.findMany({
    where: { gameDayId, status: "LIVE" },
    include: { players: { include: { player: true } } },
  });
  const claimed = new Map<string, number>();
  for (const other of live) {
    for (const row of other.players) claimed.set(row.playerId, other.courtNumber);
  }
  const duplicates: string[] = [];
  for (const match of matches) {
    for (const row of match.players) {
      const court = claimed.get(row.playerId);
      if (court !== undefined) duplicates.push(`${row.player.nickname} (${name(court)})`);
      else claimed.set(row.playerId, match.courtNumber);
    }
  }
  if (duplicates.length > 0) {
    return fail(
      `Suggestions share players: ${duplicates.join(", ")}. Clear suggestions, then auto-pair again.`,
    );
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.match.updateMany({
      where: { id: { in: matches.map((match) => match.id) } },
      data: { status: "LIVE", startedAt: now, free: Boolean(options.free) },
    }),
    prisma.sessionPlayer.updateMany({
      where: {
        gameDayId,
        playerId: { in: matches.flatMap((match) => match.players.map((row) => row.playerId)) },
      },
      data: { status: "PLAYING" },
    }),
  ]);

  refreshGameDay(gameDayId);
  return ok(
    `${matches.length} ${matches.length === 1 ? "court" : "courts"} started${options.free ? " as free games" : ""}.`,
    {
      started: matches.length,
    },
  );
}

export async function completeMatch(matchId: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { players: true } });
  if (!match) return fail("Match not found.");
  const name = await courtNamer(match.gameDayId);
  if (match.status !== "LIVE") return fail("Start the match before finishing it.");

  const now = new Date();
  const filled = await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: { status: "COMPLETED", endedAt: now },
    });
    await tx.sessionPlayer.updateMany({
      where: { gameDayId: match.gameDayId, playerId: { in: match.players.map((row) => row.playerId) } },
      data: {
        status: "WAITING",
        // A free game (used shuttle near closing) is played but not counted or billed.
        ...(match.free ? {} : { gamesPlayed: { increment: 1 } }),
        lastPlayedAt: now,
        queuedAt: now,
      },
    });
    return promoteQueuedGames(tx, match.gameDayId, match.courtNumber);
  });

  refreshGameDay(match.gameDayId);
  return ok(
    filled.length > 0
      ? `${name(match.courtNumber)} finished. Next up game moved onto ${name(filled[0])} — start it when they're ready.`
      : `${name(match.courtNumber)} finished${match.free ? " (free game, not counted)" : ""}. Players are back in the queue.`,
  );
}

/**
 * Undo an accidental "End game": the match goes back on its court as live
 * (keeping its start time) and the four players go back on court with their
 * game counts restored. A waiting game that was moved onto the freed court
 * returns to the front of the waiting line. Refused when the court or any of
 * the players has since been given to another game.
 */
export async function restoreMatch(matchId: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { players: { include: { player: true } } },
  });
  if (!match) return fail("Match not found.");
  if (match.status !== "COMPLETED") return fail("Only finished games can be restored.");

  const gameDay = await prisma.gameDay.findUnique({
    where: { id: match.gameDayId },
    select: { status: true, courtPlan: true },
  });
  if (!gameDay) return fail("Game day not found.");
  if (gameDay.status === "COMPLETED") return fail("This game day is already closed.");

  const name = await courtNamer(match.gameDayId);
  const court = match.courtNumber;
  const plan = parseCourtPlan(gameDay.courtPlan);
  const courtsNow = plan.length ? plan[currentSlotIndex(plan)].courts : 0;
  if (court < 1 || court > courtsNow) {
    return fail(`${name(court)} isn't in the current block anymore, so this game can't go back on it.`);
  }

  const others = await prisma.match.findMany({
    where: { gameDayId: match.gameDayId, status: { in: ["SUGGESTED", "LIVE"] } },
    include: { players: { include: { player: true } } },
  });
  const onCourt = others.find((other) => other.courtNumber === court);
  if (onCourt?.status === "LIVE") {
    return fail(`${name(court)} already has another game in progress. Finish or cancel it first.`);
  }

  const playerIds = new Set(match.players.map((row) => row.playerId));
  const taken = others.flatMap((other) =>
    other.players
      .filter((row) => playerIds.has(row.playerId))
      .map((row) => `${row.player.nickname} (${name(other.courtNumber)})`),
  );
  if (taken.length > 0) {
    return fail(`Already in another game: ${taken.join(", ")}. Remove them from it first.`);
  }

  const sessions = await prisma.sessionPlayer.findMany({
    where: { gameDayId: match.gameDayId, playerId: { in: [...playerIds] } },
    include: { player: { select: { nickname: true } } },
  });
  const unavailable = match.players
    .filter((row) => sessions.find((session) => session.playerId === row.playerId)?.status !== "WAITING")
    .map((row) => row.player.nickname);
  if (unavailable.length > 0) {
    return fail(`${unavailable.join(", ")} left the queue since this game ended, so it can't be restored.`);
  }

  await prisma.$transaction(async (tx) => {
    // A waiting game promoted onto this court goes back to the front of the line (it keeps its creation time).
    if (onCourt) await tx.match.update({ where: { id: onCourt.id }, data: { courtNumber: QUEUED_COURT } });
    await tx.match.update({ where: { id: matchId }, data: { status: "LIVE", endedAt: null } });
    await tx.sessionPlayer.updateMany({
      where: { gameDayId: match.gameDayId, playerId: { in: [...playerIds] } },
      data: { status: "PLAYING" },
    });
    if (!match.free) {
      await tx.sessionPlayer.updateMany({
        where: { gameDayId: match.gameDayId, playerId: { in: [...playerIds] }, gamesPlayed: { gt: 0 } },
        data: { gamesPlayed: { decrement: 1 } },
      });
    }
  });

  refreshGameDay(match.gameDayId);
  return ok(
    onCourt
      ? `${name(court)} restored — the game continues. The next game went back to the waiting courts.`
      : `${name(court)} restored — the game continues.`,
  );
}

export async function cancelMatch(matchId: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { players: true } });
  if (!match) return fail("Match not found.");
  const name = await courtNamer(match.gameDayId);
  if (match.status === "COMPLETED") return fail("Completed matches cannot be cancelled.");

  const now = new Date();
  const filled = await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id: matchId }, data: { status: "CANCELLED", endedAt: now } });
    if (match.status === "LIVE") {
      await tx.sessionPlayer.updateMany({
        where: { gameDayId: match.gameDayId, playerId: { in: match.players.map((row) => row.playerId) } },
        data: { status: "WAITING", queuedAt: now },
      });
    }
    return match.courtNumber === QUEUED_COURT
      ? []
      : promoteQueuedGames(tx, match.gameDayId, match.courtNumber);
  });

  refreshGameDay(match.gameDayId);
  return ok(
    filled.length > 0
      ? `Match cancelled. Next up game moved onto ${name(filled[0])}.`
      : "Match cancelled. Players stay in the queue.",
  );
}

export async function updateMatchPlayers(
  matchId: string,
  team1: string[],
  team2: string[],
): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  if (team1.length !== 2 || team2.length !== 2) return fail("Each team needs exactly two players.");
  const all = [...team1, ...team2];
  if (new Set(all).size !== 4) return fail("A player cannot appear twice in one match.");

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { players: true },
  });
  if (!match) return fail("Match not found.");
  const name = await courtNamer(match.gameDayId);
  if (match.status === "COMPLETED" || match.status === "CANCELLED") {
    return fail("This match can no longer be edited.");
  }

  const sessionRows = await prisma.sessionPlayer.findMany({
    where: { gameDayId: match.gameDayId, playerId: { in: all } },
    include: { player: true },
  });
  if (sessionRows.length !== 4) return fail("All four players must be checked into this game day.");

  // A player standing on another court cannot be pulled into this one.
  const otherActive = await prisma.match.findMany({
    where: {
      gameDayId: match.gameDayId,
      status: { in: ["SUGGESTED", "LIVE"] },
      id: { not: matchId },
    },
    include: { players: { include: { player: true } } },
  });
  const committed = new Map<string, { nickname: string; court: number }>();
  for (const other of otherActive) {
    if (other.courtNumber === QUEUED_COURT) continue;
    for (const row of other.players) {
      committed.set(row.playerId, { nickname: row.player.nickname, court: other.courtNumber });
    }
  }
  // Games in the waiting line are plans, so they never block a lineup, and a planned game can
  // use players already elsewhere. Only real courts claim a player.
  if (match.courtNumber !== QUEUED_COURT) {
    const taken = all.find((playerId) => committed.has(playerId));
    if (taken) {
      const entry = committed.get(taken)!;
      return fail(`${entry.nickname} is already queued for ${name(entry.court)}.`);
    }
  } else {
    const notIn = sessionRows.find((row) => row.status === "EXPECTED" || row.status === "DONE");
    if (notIn) return fail(`${notIn.player.nickname} is not on the board (${notIn.status.toLowerCase()}).`);
  }

  const oldIds = match.players.map((row) => row.playerId);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (match.status === "LIVE") {
      await tx.sessionPlayer.updateMany({
        where: { gameDayId: match.gameDayId, playerId: { in: oldIds } },
        data: { status: "WAITING", queuedAt: now },
      });
    }
    await tx.matchPlayer.deleteMany({ where: { matchId } });
    await tx.matchPlayer.createMany({
      data: [
        ...team1.map((playerId, index) => ({ matchId, playerId, team: 1, slot: index + 1 })),
        ...team2.map((playerId, index) => ({ matchId, playerId, team: 2, slot: index + 1 })),
      ],
    });
    if (match.status === "LIVE") {
      await tx.sessionPlayer.updateMany({
        where: { gameDayId: match.gameDayId, playerId: { in: all } },
        data: { status: "PLAYING" },
      });
    }
  });

  refreshGameDay(match.gameDayId);
  return ok("Match line-up updated.");
}

export async function updateMatchCourt(matchId: string, courtNumber: number): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  if (!Number.isInteger(courtNumber) || courtNumber < 1 || courtNumber > 20)
    return fail("Pick a valid court.");

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return fail("Match not found.");
  const name = await courtNamer(match.gameDayId);
  if (match.status === "COMPLETED") return fail("Completed matches cannot be moved.");

  const clash = await prisma.match.findFirst({
    where: {
      gameDayId: match.gameDayId,
      courtNumber,
      status: { in: ["SUGGESTED", "LIVE"] },
      id: { not: matchId },
    },
  });
  if (clash) return fail(`${name(courtNumber)} already has a match.`);

  await prisma.match.update({ where: { id: matchId }, data: { courtNumber } });
  refreshGameDay(match.gameDayId);
  return ok(`Moved to ${name(courtNumber)}.`);
}

/**
 * Add one court mid-session for the time it is used: from `from` until `until`
 * (or the end of the reservation when `until` is null). The court plan is split
 * around that time, so the rent, and each player's share, counts the court only
 * for those hours. A game waiting in Next up moves straight onto the court when
 * it is in play now. `slotIndex` is the block the queue master is looking at;
 * the answer says which block to show after the plan is split.
 */
export async function addCourt(
  gameDayId: string,
  slotIndex: number,
  input: { label?: string; from: string; until: string | null },
): Promise<ActionResult<{ slotIndex: number }>> {
  const authError = await guard();
  if (authError) return authError;

  const gameDay = await prisma.gameDay.findUnique({
    where: { id: gameDayId },
    select: { status: true, courtPlan: true },
  });
  if (!gameDay) return fail("Game day not found.");
  if (gameDay.status === "COMPLETED") return fail("This game day is already closed.");

  const parsed = addCourtSchema.safeParse(input);
  if (!parsed.success) return fail("Pick when the court is used.");

  const plan = parseCourtPlan(gameDay.courtPlan);
  if (!plan[slotIndex]) return fail("Pick a court block first.");
  const reserved = planWindow(plan);
  if (!reserved) return fail("Add a court block in Settings first.");
  const wasInPlay = slotIndex === currentSlotIndex(plan);

  const stamp = Date.now();
  const result = addCourtForWindow(
    plan,
    parsed.data.from,
    parsed.data.until ?? reserved.end,
    normalizeCourtLabel(parsed.data.label ?? ""),
    (index) => `slot-${stamp}-${index}`,
  );
  if ("error" in result) return fail(result.error);

  // Games sit on court positions of the block in play, so a waiting game only moves onto the
  // new court when the court is in play right now.
  const nowIndex = currentSlotIndex(result.plan);
  const inPlay = result.added[nowIndex];
  const filled = await prisma.$transaction(async (tx) => {
    await tx.gameDay.update({ where: { id: gameDayId }, data: { courtPlan: result.plan } });
    return inPlay ? promoteQueuedGames(tx, gameDayId, result.plan[nowIndex].courts, nowIndex) : [];
  });

  refreshGameDay(gameDayId);
  const withCourt = result.plan.filter((_, index) => result.added[index]);
  const first = withCourt[0];
  const name = courtName(first, first.courts);
  const when = `${formatTime12(first.start)}–${formatTime12(withCourt[withCourt.length - 1].end)}`;
  const fromSame = (index: number) => result.origins[index] === slotIndex;
  const firstAdded = result.plan.findIndex((_, index) => fromSame(index) && result.added[index]);
  const view = wasInPlay
    ? nowIndex
    : firstAdded >= 0
      ? firstAdded
      : Math.max(
          0,
          result.plan.findIndex((_, index) => fromSame(index)),
        );
  return ok(
    filled.length > 0
      ? `${name} added for ${when}. The first Next up game moved onto it.`
      : inPlay
        ? `${name} added for ${when}.`
        : `${name} added for ${when}. It shows on the board in that court block.`,
    { slotIndex: view },
  );
}

/**
 * Remove one court from a block mid-session, e.g. when a reservation falls
 * through. A suggested game on it moves to the waiting courts; a game in
 * progress must be finished or cancelled first. Later courts keep their names.
 */
export async function removeCourt(
  gameDayId: string,
  slotIndex: number,
  court: number,
): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const gameDay = await prisma.gameDay.findUnique({
    where: { id: gameDayId },
    select: { status: true, courtPlan: true },
  });
  if (!gameDay) return fail("Game day not found.");
  if (gameDay.status === "COMPLETED") return fail("This game day is already closed.");

  const plan = parseCourtPlan(gameDay.courtPlan);
  const slot = plan[slotIndex];
  if (!slot) return fail("Pick a court block first.");
  if (!Number.isInteger(court) || court < 1 || court > slot.courts) return fail("Pick a valid court.");
  const name = courtName(slot, court);
  if (slot.courts <= 1)
    return fail(`${name} is the only court in ${slot.label}. Change the block in Settings instead.`);

  // Games sit on court positions of the block in play, so only that block's games move.
  const inPlay = slotIndex === currentSlotIndex(plan);
  const onCourt = inPlay
    ? await prisma.match.findFirst({
        where: { gameDayId, courtNumber: court, status: { in: ["SUGGESTED", "LIVE"] } },
        select: { id: true, status: true },
      })
    : null;
  if (onCourt?.status === "LIVE") return fail(`${name} has a game in progress. Finish or cancel it first.`);

  const nextPlan = plan.map((row, index) => (index === slotIndex ? withoutCourt(row, court) : row));
  await prisma.$transaction(async (tx) => {
    await tx.gameDay.update({ where: { id: gameDayId }, data: { courtPlan: nextPlan } });
    if (!inPlay) return;
    if (onCourt) await tx.match.update({ where: { id: onCourt.id }, data: { courtNumber: QUEUED_COURT } });
    await tx.match.updateMany({
      where: { gameDayId, status: { in: ["SUGGESTED", "LIVE"] }, courtNumber: { gt: court } },
      data: { courtNumber: { decrement: 1 } },
    });
  });

  refreshGameDay(gameDayId);
  return ok(
    onCourt
      ? `${name} removed. Its suggested game moved to the waiting courts.`
      : `${name} removed from ${slot.label}.`,
  );
}

/** Rename a court from the board, in one block or at that position in every block. */
export async function renameCourt(
  gameDayId: string,
  slotIndex: number,
  court: number,
  label: string,
  everyBlock: boolean,
): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const gameDay = await prisma.gameDay.findUnique({ where: { id: gameDayId }, select: { courtPlan: true } });
  if (!gameDay) return fail("Game day not found.");
  const plan = parseCourtPlan(gameDay.courtPlan);
  const slot = plan[slotIndex];
  if (!slot) return fail("Pick a court block first.");
  if (!Number.isInteger(court) || court < 1 || court > slot.courts) return fail("Pick a valid court.");

  const result = renamedCourt(plan, slotIndex, court, label, everyBlock);
  if ("error" in result) return fail(result.error);

  await prisma.gameDay.update({ where: { id: gameDayId }, data: { courtPlan: result.plan } });
  refreshGameDay(gameDayId);
  const before = courtName(slot, court);
  const after = courtName(result.plan[slotIndex], court);
  return ok(
    before === after
      ? `${after} unchanged.`
      : `${before} is now ${after}${everyBlock ? " in every block" : ""}.`,
  );
}

function feeScheduleFor(gameDay: {
  courtPlan: unknown;
  courtRatePerHour: number | null;
  players: Array<{ status: string }>;
  venue: { shortName: string };
}) {
  return buildFeeSchedule({
    courtPlan: parseCourtPlan(gameDay.courtPlan),
    ratePerCourtHour: gameDay.courtRatePerHour,
    venueShortName: gameDay.venue.shortName,
    attendees: gameDay.players.filter((player) => player.status !== "EXPECTED").length,
  });
}

type PaymentInput = {
  paid: boolean;
  amountPaid?: number;
  method?: "CASH" | "GCASH" | "BANK" | "OTHER" | null;
  /** Grips and any other charge for this player; omitted leaves them as they are. */
  charges?: { gripCount: number; otherCharge: number; otherNote?: string | null };
};

export async function setPayment(sessionPlayerId: string, input: PaymentInput): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const row = await prisma.sessionPlayer.findUnique({
    where: { id: sessionPlayerId },
    include: {
      gameDay: { include: { venue: true, players: { select: { status: true } } } },
      player: true,
    },
  });
  if (!row) return fail("Player not found in this game day.");

  let gripCount = row.gripCount;
  let otherCharge = row.otherCharge;
  let otherNote = row.otherNote;
  if (input.charges) {
    const parsed = chargesSchema.safeParse(input.charges);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the extra charges.");
    gripCount = parsed.data.gripCount;
    otherCharge = parsed.data.otherCharge;
    otherNote = otherCharge > 0 ? parsed.data.otherNote || null : null;
  }

  const fee = feeScheduleFor(row.gameDay).feeFor(row.player.category, row.gamesPlayed);
  const total = fee.total + extrasTotal({ gripCount, otherCharge });
  const amount = Math.max(0, Math.round(input.amountPaid ?? (input.paid ? total : 0)));
  // The amount decides: fully covered is paid. Only a zero-total player can be marked paid outright.
  const paid = total > 0 ? amount >= total : input.paid;
  const kept = paid ? amount : Math.min(amount, total);

  await prisma.sessionPlayer.update({
    where: { id: sessionPlayerId },
    data: {
      paid,
      amountPaid: kept,
      paymentMethod: paid ? (input.method ?? "CASH") : null,
      gripCount,
      otherCharge,
      otherNote,
      // Exact payment is settled right away; overpaying leaves it open until the change is handed back.
      settled: paid && changeDue(total, kept) === 0,
    },
  });

  refreshGameDay(row.gameDayId);
  return ok(
    paid
      ? changeDue(total, kept) > 0
        ? `${row.player.nickname} paid. Give back ${formatPeso(changeDue(total, kept))} change.`
        : `${row.player.nickname} marked paid.`
      : "Saved.",
  );
}

/** Tick or untick "settled": paid in full and any change handed back. */
export async function setSettled(sessionPlayerId: string, settled: boolean): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const row = await prisma.sessionPlayer.findUnique({
    where: { id: sessionPlayerId },
    include: { player: true },
  });
  if (!row) return fail("Player not found in this game day.");
  if (settled && !row.paid) return fail(`${row.player.nickname} has not paid in full yet.`);

  await prisma.sessionPlayer.update({ where: { id: sessionPlayerId }, data: { settled } });
  refreshGameDay(row.gameDayId);
  return ok(settled ? `${row.player.nickname} settled.` : `${row.player.nickname} reopened.`);
}

export async function markAllPaid(gameDayId: string): Promise<ActionResult<{ updated: number }>> {
  const authError = await guard();
  if (authError) return authError;

  const gameDay = await prisma.gameDay.findUnique({
    where: { id: gameDayId },
    include: {
      venue: true,
      players: { include: { player: true } },
    },
  });
  if (!gameDay) return fail("Game day not found.");

  const schedule = feeScheduleFor(gameDay);
  let updated = 0;
  for (const row of gameDay.players) {
    if (row.paid) continue;
    const total = schedule.feeFor(row.player.category, row.gamesPlayed).total + extrasTotal(row);
    await prisma.sessionPlayer.update({
      where: { id: row.id },
      data: { paid: true, amountPaid: total, paymentMethod: "CASH", settled: true },
    });
    updated += 1;
  }

  refreshGameDay(gameDayId);
  return ok(updated ? `${updated} players marked paid.` : "Everyone is already marked paid.", { updated });
}

/** Sets real levels for players still marked X, from the queue board's prompt. */
export async function setPlayerLevels(
  gameDayId: string,
  levels: { playerId: string; level: string }[],
): Promise<ActionResult<{ updated: number }>> {
  const authError = await guard();
  if (authError) return authError;
  const parsed: { playerId: string; level: NonNullable<ReturnType<typeof parseLevel>> }[] = [];
  for (const row of levels) {
    const level = parseLevel(row.level);
    if (!level || isUnrated(level)) return fail("Pick a level for every player, from E- to A+.");
    if (typeof row.playerId !== "string" || !row.playerId) return fail("Player not found.");
    parsed.push({ playerId: row.playerId, level });
  }
  if (parsed.length === 0) return fail("Pick at least one level.");
  // Only players on this game day can be changed from its board.
  const onDay = await prisma.sessionPlayer.count({
    where: { gameDayId, playerId: { in: parsed.map((row) => row.playerId) } },
  });
  if (onDay !== new Set(parsed.map((row) => row.playerId)).size)
    return fail("Player not found on this game day.");
  await prisma.$transaction(
    parsed.map((row) => prisma.player.update({ where: { id: row.playerId }, data: { level: row.level } })),
  );
  refreshGameDay(gameDayId);
  return ok(parsed.length === 1 ? "Level saved." : `${parsed.length} levels saved.`, {
    updated: parsed.length,
  });
}

export async function createQuickPlayer(
  input: PlayerInput,
): Promise<ActionResult<{ id: string; nickname: string; level: string }>> {
  const authError = await guard();
  if (authError) return authError;

  const nickname = input.nickname?.trim();
  if (!nickname) return fail("Enter a nickname.");

  const exists = await prisma.player.findUnique({ where: { nickname } });
  if (exists) return fail("That nickname already exists. Pick them from the database instead.");

  const level = parseLevel(input.level);
  if (!level) return fail("Pick a valid level.");
  const category = parseCategory(input.category);
  if (!category) return fail("Pick a valid player type.");

  const player = await prisma.player.create({
    data: { nickname, level, category, fullName: input.fullName || null },
  });
  revalidatePath("/app/players");
  return ok(`${player.nickname} (${levelLabel(player.level)}) added to the database.`, {
    id: player.id,
    nickname: player.nickname,
    level: levelLabel(player.level),
  });
}

/**
 * Place four checked-in players on a court by hand (drag and drop).
 * The first two become Team 1, the last two Team 2.
 */
export async function createManualMatch(
  gameDayId: string,
  courtNumber: number,
  playerIds: string[],
): Promise<ActionResult<{ matchId: string }>> {
  const authError = await guard();
  if (authError) return authError;

  // QUEUED_COURT (0) builds the game in the waiting court instead of on a court.
  if (!Number.isInteger(courtNumber) || courtNumber < QUEUED_COURT || courtNumber > 20)
    return fail("Pick a valid court.");
  if (playerIds.length !== 4 || new Set(playerIds).size !== 4)
    return fail("A court needs four different players.");

  const gameDay = await prisma.gameDay.findUnique({
    where: { id: gameDayId },
    include: {
      players: { include: { player: true } },
      matches: {
        select: {
          round: true,
          courtNumber: true,
          status: true,
          players: { select: { playerId: true } },
        },
      },
    },
  });
  if (!gameDay) return fail("Game day not found.");
  if (gameDay.status === "COMPLETED") return fail("This game day is already closed.");
  const name = await courtNamer(gameDayId);

  // A waiting-court game is planned ahead, so players still on court can be in it. A real court
  // starts soon, so it takes only players who are waiting.
  const planning = courtNumber === QUEUED_COURT;
  const eligible = new Set(
    gameDay.players
      .filter((row) => row.status === "WAITING" || (planning && row.status === "PLAYING"))
      .map((row) => row.playerId),
  );
  if (playerIds.some((playerId) => !eligible.has(playerId)))
    return fail(
      planning
        ? "Only checked-in players who are waiting or playing can be planned into a waiting game."
        : "Only checked-in, waiting players can be placed on a court.",
    );

  const clash =
    courtNumber === QUEUED_COURT
      ? undefined
      : gameDay.matches.find(
          (match) =>
            match.courtNumber === courtNumber && (match.status === "SUGGESTED" || match.status === "LIVE"),
        );
  if (clash) return fail(`${name(courtNumber)} already has a match.`);

  const nicknameById = new Map(gameDay.players.map((row) => [row.playerId, row.player.nickname]));
  for (const match of gameDay.matches) {
    if (match.status !== "SUGGESTED" && match.status !== "LIVE") continue;
    // Planned (waiting-court) games never block, and do not count against a real court.
    if (planning || match.courtNumber === QUEUED_COURT) continue;
    for (const row of match.players) {
      if (playerIds.includes(row.playerId)) {
        return fail(
          `${nicknameById.get(row.playerId) ?? "A player"} is already queued for ${name(match.courtNumber)}.`,
        );
      }
    }
  }

  const round = Math.max(0, ...gameDay.matches.map((match) => match.round)) + 1;
  const match = await prisma.match.create({
    data: {
      gameDayId,
      courtNumber,
      round,
      status: "SUGGESTED",
      players: {
        create: [
          ...playerIds.slice(0, 2).map((playerId, index) => ({
            playerId,
            team: 1,
            slot: index + 1,
          })),
          ...playerIds.slice(2).map((playerId, index) => ({
            playerId,
            team: 2,
            slot: index + 1,
          })),
        ],
      },
    },
  });

  refreshGameDay(gameDayId);
  if (courtNumber === QUEUED_COURT) {
    const inLine =
      gameDay.matches.filter((row) => row.courtNumber === QUEUED_COURT && row.status === "SUGGESTED").length +
      1;
    return ok(`Game set in the waiting court as #${inLine} — it takes the next free court.`, {
      matchId: match.id,
    });
  }
  return ok(`${name(courtNumber)} set by hand.`, { matchId: match.id });
}

/**
 * Move a match to another court. If that court is already taken by another
 * active match, the two matches swap courts.
 */
export async function moveMatchToCourt(matchId: string, courtNumber: number): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  if (!Number.isInteger(courtNumber) || courtNumber < 1 || courtNumber > 20)
    return fail("Pick a valid court.");

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return fail("Match not found.");
  const name = await courtNamer(match.gameDayId);
  if (match.status === "COMPLETED" || match.status === "CANCELLED")
    return fail("This match can no longer be moved.");
  if (match.courtNumber === courtNumber) return ok("Match is already on that court.");

  const occupant = await prisma.match.findFirst({
    where: {
      gameDayId: match.gameDayId,
      courtNumber,
      status: { in: ["SUGGESTED", "LIVE"] },
      id: { not: matchId },
    },
  });

  if (occupant && match.courtNumber === QUEUED_COURT) {
    return fail(`${name(courtNumber)} is in use. Finish or cancel that game first.`);
  }

  if (occupant) {
    await prisma.$transaction([
      prisma.match.update({ where: { id: matchId }, data: { courtNumber } }),
      prisma.match.update({ where: { id: occupant.id }, data: { courtNumber: match.courtNumber } }),
    ]);
    refreshGameDay(match.gameDayId);
    return ok(`Swapped ${name(match.courtNumber)} and ${name(courtNumber)}.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id: matchId }, data: { courtNumber } });
    if (match.courtNumber !== QUEUED_COURT) await promoteQueuedGames(tx, match.gameDayId, match.courtNumber);
  });
  refreshGameDay(match.gameDayId);
  return ok(
    match.courtNumber === QUEUED_COURT
      ? `Next up game sent to ${name(courtNumber)}.`
      : `Moved to ${name(courtNumber)}.`,
  );
}

/**
 * Swap two players between two active matches without disturbing the rest of
 * either line-up. Used when a queue master drags one player chip onto another.
 */
export async function swapMatchPlayers(
  matchIdA: string,
  playerIdA: string,
  matchIdB: string,
  playerIdB: string,
): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  if (matchIdA === matchIdB) return fail("Drop a player onto another match to swap.");
  if (playerIdA === playerIdB) return ok("No change.");

  const matches = await prisma.match.findMany({
    where: { id: { in: [matchIdA, matchIdB] } },
    include: { players: true },
  });
  if (matches.length !== 2) return fail("Match not found.");
  const [a, b] = matches;
  if (a.gameDayId !== b.gameDayId) return fail("Matches must belong to the same game day.");
  if ([a, b].some((match) => match.status === "COMPLETED" || match.status === "CANCELLED"))
    return fail("Finished matches cannot be changed.");

  const rowA = a.players.find((row) => row.playerId === playerIdA);
  const rowB = b.players.find((row) => row.playerId === playerIdB);
  if (!rowA || !rowB) return fail("Those players are not on those courts.");
  if (a.players.some((row) => row.playerId === playerIdB))
    return fail("That swap would duplicate a player on one court.");
  if (b.players.some((row) => row.playerId === playerIdA))
    return fail("That swap would duplicate a player on one court.");

  await prisma.$transaction([
    prisma.matchPlayer.update({
      where: { matchId_playerId: { matchId: matchIdA, playerId: playerIdA } },
      data: { playerId: playerIdB },
    }),
    prisma.matchPlayer.update({
      where: { matchId_playerId: { matchId: matchIdB, playerId: playerIdB } },
      data: { playerId: playerIdA },
    }),
  ]);

  for (const [match, incomingId, outgoingId] of [
    [a, playerIdB, playerIdA],
    [b, playerIdA, playerIdB],
  ] as const) {
    const ids = match.players.map((row) => row.playerId).filter((id) => id !== outgoingId);
    ids.push(incomingId);
    if (match.status === "LIVE") {
      await prisma.sessionPlayer.updateMany({
        where: { gameDayId: match.gameDayId, playerId: { in: ids } },
        data: { status: "PLAYING" },
      });
    } else {
      await prisma.sessionPlayer.updateMany({
        where: { gameDayId: match.gameDayId, playerId: { in: ids } },
        data: { status: "WAITING" },
      });
    }
  }

  refreshGameDay(a.gameDayId);
  return ok("Players swapped.");
}
