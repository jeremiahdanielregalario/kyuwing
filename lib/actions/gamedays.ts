"use server";

import type { GameDayType, PlayerCategory, Prisma } from "@prisma/client";
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
  formatGameDate,
  openCourts,
  parseCourtPlan,
  normalizeCourtLabel,
  QUEUED_COURT,
  renamedCourt,
  timeToMinutes,
  withoutCourt,
} from "@/lib/datetime";
import { buildFeeSchedule } from "@/lib/fees";
import { levelLabel, parseLevel } from "@/lib/levels";
import { suggestMatches, type PairingHistoryMatch, type PairingPlayer } from "@/lib/pairing";
import { gameDayCreateSchema, gameDayUpdateSchema, parseCategory, type PlayerInput } from "@/lib/validation";

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
  const queued = await tx.match.findMany({
    where: { gameDayId, status: "SUGGESTED", courtNumber: QUEUED_COURT },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
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
  for (const slot of plan) {
    if (timeToMinutes(slot.end) <= timeToMinutes(slot.start)) {
      return "Each court block must end after it starts.";
    }
  }
  return null;
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
      queueMasterName: parsed.data.queueMasterName || null,
      financeMemberName: parsed.data.financeMemberName || null,
      courtRatePerHour: parsed.data.courtRatePerHour ?? null,
    },
  });

  refreshGameDay(gameDay.id);
  return ok("Game day created. Add your sign-ups next.", { id: gameDay.id });
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
    await prisma.$transaction([
      prisma.match.updateMany({
        where: { gameDayId: id, status: { in: ["SUGGESTED", "LIVE"] } },
        data: { status: "CANCELLED", endedAt: new Date() },
      }),
      prisma.sessionPlayer.updateMany({
        where: { gameDayId: id, status: "PLAYING" },
        data: { status: "DONE", queuedAt: null },
      }),
      prisma.gameDay.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
    ]);
    refreshGameDay(id);
    return ok("Game day closed. Reports are ready to export.");
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

  await prisma.$transaction(async (tx) => {
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
  });

  refreshGameDay(gameDayId);
  const counted =
    countLiveGames && live.length > 0
      ? ` ${live.length} game${live.length === 1 ? "" : "s"} in progress counted.`
      : "";
  return ok(`Game day ended.${counted} Collect fees next.`);
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
  options: { queue?: boolean } = {},
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

  const active = gameDay.matches.filter((match) => match.status === "SUGGESTED" || match.status === "LIVE");
  const freeCourts = openCourts(
    slot.courts,
    active.map((match) => match.courtNumber),
  );

  // Games already waiting in the Next up line get open courts before anyone new is paired.
  if (!options.queue && freeCourts.length > 0 && active.some((match) => match.courtNumber === QUEUED_COURT)) {
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
  const waiting = gameDay.players.filter(
    (row) => row.status === "WAITING" && !busyPlayerIds.has(row.playerId),
  );
  if (waiting.length < 4) return fail("At least four players need to be checked in and waiting.");

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
    waitMinutes: elapsedMinutes(row.queuedAt ?? row.joinedAt),
    gamesPlayed: row.gamesPlayed,
    priority: row.priority,
    permanentPartnerId: row.permanentPartnerId,
    requests: requestsByPlayer.get(row.playerId) ?? [],
  }));

  const history: PairingHistoryMatch[] = gameDay.matches
    .filter((match) => match.status === "COMPLETED")
    .map((match) => ({
      round: match.round,
      playerIds: match.players.map((row) => row.playerId),
      team1: match.players.filter((row) => row.team === 1).map((row) => row.playerId),
      team2: match.players.filter((row) => row.team === 2).map((row) => row.playerId),
    }));

  const nextRound = Math.max(0, ...gameDay.matches.map((match) => match.round)) + 1;
  const suggestions = suggestMatches(pairingPlayers, history, {
    courts: queueing ? 1 : Math.max(1, Math.min(freeCourts.length, maxMatches ?? freeCourts.length)),
    round: nextRound,
    scarcity: waiting.length < 10,
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
    return fail("The pairing engine could not build a fair match from the current queue.");

  await prisma.$transaction(
    disjointSuggestions.map((suggestion, index) =>
      prisma.match.create({
        data: {
          gameDayId,
          courtNumber: queueing ? QUEUED_COURT : freeCourts[index],
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
  );

  refreshGameDay(gameDayId);
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
    `${disjointSuggestions.length} ${disjointSuggestions.length === 1 ? "match" : "matches"} suggested on ${freeCourts
      .slice(0, disjointSuggestions.length)
      .map((court) => courtName(slot, court))
      .join(", ")}. Review and start.`,
    { matches: suggestions.length },
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
    const claimed = new Map<string, number>();
    for (const other of others) {
      for (const row of other.players) claimed.set(row.playerId, other.courtNumber);
    }
    for (const row of match.players) {
      const other = claimed.get(row.playerId);
      if (other !== undefined) clashed.push(`${row.player.nickname} (${name(other)})`);
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
    return fail(`Already queued for another court: ${clashed.join(", ")}. Cancel that match first.`);
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
    for (const row of other.players) {
      committed.set(row.playerId, { nickname: row.player.nickname, court: other.courtNumber });
    }
  }
  const taken = all.find((playerId) => committed.has(playerId));
  if (taken) {
    const entry = committed.get(taken)!;
    return fail(`${entry.nickname} is already queued for ${name(entry.court)}.`);
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
 * Add one court to a block mid-session, e.g. when the venue frees an extra
 * court for a time slot. A game waiting in Next up moves straight onto it.
 */
export async function addCourt(
  gameDayId: string,
  slotIndex: number,
  label?: string,
): Promise<ActionResult<{ court: number }>> {
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
  if (slot.courts >= 20) return fail("A block can have at most 20 courts.");

  const court = slot.courts + 1;
  const courtLabels = Array.from({ length: slot.courts }, (_, index) => slot.courtLabels?.[index] ?? "");
  courtLabels.push(normalizeCourtLabel(label ?? ""));
  const nextSlot = { ...slot, courts: court, courtLabels };
  const nextPlan = plan.map((row, index) => (index === slotIndex ? nextSlot : row));

  const filled = await prisma.$transaction(async (tx) => {
    await tx.gameDay.update({ where: { id: gameDayId }, data: { courtPlan: nextPlan } });
    return promoteQueuedGames(tx, gameDayId, court, slotIndex);
  });

  refreshGameDay(gameDayId);
  const name = courtName(nextSlot, court);
  return ok(
    filled.length > 0
      ? `${name} added to ${slot.label}. The first Next up game moved onto it.`
      : `${name} added to ${slot.label}.`,
    { court },
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
  type: GameDayType;
  courtPlan: unknown;
  courtRatePerHour: number | null;
  players: Array<{ status: string }>;
  venue: {
    feeRules: Array<{ dayType: GameDayType; category: PlayerCategory; flatFee: number; perGameFee: number }>;
  };
}) {
  return buildFeeSchedule({
    type: gameDay.type,
    courtPlan: parseCourtPlan(gameDay.courtPlan),
    ratePerCourtHour: gameDay.courtRatePerHour,
    attendees: gameDay.players.filter((player) => player.status !== "EXPECTED").length,
    rules: gameDay.venue.feeRules,
  });
}

export async function setPayment(
  sessionPlayerId: string,
  input: { paid: boolean; amountPaid?: number; method?: "CASH" | "GCASH" | "BANK" | "OTHER" | null },
): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const row = await prisma.sessionPlayer.findUnique({
    where: { id: sessionPlayerId },
    include: {
      gameDay: { include: { venue: { include: { feeRules: true } }, players: { select: { status: true } } } },
      player: true,
    },
  });
  if (!row) return fail("Player not found in this game day.");

  const total = feeScheduleFor(row.gameDay).feeFor(row.player.category, row.gamesPlayed).total;
  const amount = Math.max(0, Math.round(input.amountPaid ?? (input.paid ? total : 0)));

  await prisma.sessionPlayer.update({
    where: { id: sessionPlayerId },
    data: {
      paid: input.paid,
      amountPaid: input.paid ? amount : Math.min(amount, total),
      paymentMethod: input.paid ? (input.method ?? "CASH") : null,
    },
  });

  refreshGameDay(row.gameDayId);
  return ok(input.paid ? `${row.player.nickname} marked paid.` : "Payment cleared.");
}

export async function markAllPaid(gameDayId: string): Promise<ActionResult<{ updated: number }>> {
  const authError = await guard();
  if (authError) return authError;

  const gameDay = await prisma.gameDay.findUnique({
    where: { id: gameDayId },
    include: {
      venue: { include: { feeRules: true } },
      players: { include: { player: true } },
    },
  });
  if (!gameDay) return fail("Game day not found.");

  const schedule = feeScheduleFor(gameDay);
  let updated = 0;
  for (const row of gameDay.players) {
    if (row.paid) continue;
    const total = schedule.feeFor(row.player.category, row.gamesPlayed).total;
    await prisma.sessionPlayer.update({
      where: { id: row.id },
      data: { paid: true, amountPaid: total, paymentMethod: "CASH" },
    });
    updated += 1;
  }

  refreshGameDay(gameDayId);
  return ok(updated ? `${updated} players marked paid.` : "Everyone is already marked paid.", { updated });
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

  const waiting = new Set(
    gameDay.players.filter((row) => row.status === "WAITING").map((row) => row.playerId),
  );
  if (playerIds.some((playerId) => !waiting.has(playerId)))
    return fail("Only checked-in, waiting players can be placed on a court.");

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
