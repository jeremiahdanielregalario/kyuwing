"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { fail, ok } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { isQueueMaster } from "@/lib/auth";
import type { BoardOpBody, OpResult } from "@/lib/board-engine/ops";
import type { MatchRecord } from "@/lib/board-engine/matches";
import type { PaymentInput } from "@/lib/board-engine/fees";
import type { GenerateOptions } from "@/lib/board-engine/generate";
import { runOps } from "@/lib/board-store";
import { prisma } from "@/lib/db";
import { dateOnlyFromKey, formatGameDate } from "@/lib/datetime";
import { currentClaimant } from "@/lib/device";
import type { CourtSetup } from "@/lib/court-setup";
import { planProblem } from "@/lib/court-plan";
import { defaultFlatBaseFee } from "@/lib/fees";
import { levelLabel, parseLevel } from "@/lib/levels";
import { refreshAttendance, refreshGameDay } from "@/lib/refresh";
import { checkSignup, notReadyReason } from "@/lib/signup-check";
import { officerNames } from "@/lib/signup-text";
import { gameDayCreateSchema, gameDayUpdateSchema, parseCategory, type PlayerInput } from "@/lib/validation";

async function guard() {
  if (!(await isQueueMaster())) return fail("Your queue-master session expired. Sign in again.");
  return null;
}

function validateCourtPlan(plan: Array<{ start: string; end: string }>) {
  return planProblem(plan);
}

/**
 * Board, Fees and Sign-ups changes run through the board engine (lib/board-engine), the same
 * code the tablet runs offline, so a press gives the same answer wherever it is applied.
 */
async function run<T = undefined>(
  gameDayId: string | null | undefined,
  body: BoardOpBody,
): Promise<ActionResult<T>> {
  const authError = await guard();
  if (authError) return authError;
  if (!gameDayId) return fail(notFoundMessage(body));
  const { results, state, closed } = await runOps(
    gameDayId,
    [{ id: randomUUID(), at: Date.now(), ...body }],
    await currentClaimant(),
  );
  if (!state) return fail("Game day not found.");
  const result = results[0] as OpResult;
  if (result.ok) {
    refreshGameDay(gameDayId);
    if (closed) refreshAttendance();
    if (body.type === "addWalkIn" || body.type === "setLevels") revalidatePath("/app/players");
  }
  return result as ActionResult<T>;
}

function notFoundMessage(body: BoardOpBody): string {
  if (body.type === "confirmLeave" || body.type === "declineLeave")
    return "That request was already handled.";
  if (body.type === "setPayment" || body.type === "setSettled") return "Player not found in this game day.";
  if (body.type === "deleteRequest") return "Request not found.";
  if ("matchId" in body || "matchIdA" in body) return "Match not found.";
  if ("sessionPlayerId" in body) return "Sign-up not found.";
  return "Game day not found.";
}

async function dayOfSignup(sessionPlayerId: string) {
  const row = await prisma.sessionPlayer.findUnique({
    where: { id: sessionPlayerId },
    select: { gameDayId: true },
  });
  return row?.gameDayId;
}

async function dayOfMatch(matchId: string) {
  const row = await prisma.match.findUnique({ where: { id: matchId }, select: { gameDayId: true } });
  return row?.gameDayId;
}

async function dayOfLeave(requestId: string) {
  const row = await prisma.leaveRequest.findUnique({ where: { id: requestId }, select: { gameDayId: true } });
  return row?.gameDayId;
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
  const texts = { members: parsed.data.signupText ?? "", applicants: parsed.data.applicantsText ?? "" };
  if (texts.members.trim() || texts.applicants.trim()) {
    const check = await checkSignup(texts);
    if (!check.ready) return fail(notReadyReason(check));
    const confirmed = check.lines.filter((line) => !line.waitlist);
    const nicknames = [...new Set(confirmed.map((line) => line.nickname!))];
    const found = await prisma.player.findMany({
      where: { nickname: { in: nicknames } },
      select: { id: true },
    });
    playerIds = found.map((player) => player.id);
    listQueueMaster = officerNames(confirmed, "QM");
    listFinance = officerNames(confirmed, "FIN");
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
      // New game days start on the venue's flat rate (DASC ₱150, KBC ₱100). A venue without
      // one starts on the split; the queue master can switch on the Fees page either way.
      flatBaseFee: defaultFlatBaseFee(venue.shortName),
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

export async function deleteGameDay(id: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  await prisma.gameDay.delete({ where: { id } });
  revalidatePath("/app/gamedays");
  revalidatePath("/app");
  return ok("Game day deleted.");
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

export async function setGameDayStatus(
  id: string,
  status: "DRAFT" | "LIVE" | "COMPLETED",
): Promise<ActionResult> {
  return run(id, { type: "setStatus", status });
}

/** Start a draft game day once the courts are confirmed. */
export async function startGameDay(id: string, setup: CourtSetup[]): Promise<ActionResult> {
  return run(id, { type: "startGameDay", setup });
}

/** Extend a live game day past its reservation. */
export async function extendGameDay(gameDayId: string, until: string, courts: number): Promise<ActionResult> {
  return run(gameDayId, { type: "extendGameDay", until, courts });
}

/** Close the game day at the end of the reservation; attendance is logged. */
export async function endGameDay(gameDayId: string, countLiveGames: boolean): Promise<ActionResult> {
  return run(gameDayId, { type: "endGameDay", countLiveGames });
}

export async function addPlayerToGameDay(
  gameDayId: string,
  playerId: string,
  checkInNow = false,
): Promise<ActionResult> {
  return run(gameDayId, { type: "addPlayer", playerId, checkInNow });
}

export async function addAllActivePlayers(gameDayId: string): Promise<ActionResult<{ added: number }>> {
  return run(gameDayId, { type: "addAllActive" });
}

export async function addWalkIn(
  gameDayId: string,
  input: { nickname: string; level: string; category: string },
): Promise<ActionResult<{ sessionPlayerId: string }>> {
  return run(gameDayId, { type: "addWalkIn", input });
}

export async function removePlayerFromGameDay(sessionPlayerId: string): Promise<ActionResult> {
  return run(await dayOfSignup(sessionPlayerId), { type: "removePlayer", sessionPlayerId });
}

/** Takes a check-in back, for a mistake (see `canUndoCheckIn`). */
export async function undoCheckIn(sessionPlayerId: string): Promise<ActionResult> {
  return run(await dayOfSignup(sessionPlayerId), { type: "undoCheckIn", sessionPlayerId });
}

export async function checkInPlayer(sessionPlayerId: string): Promise<ActionResult> {
  return run(await dayOfSignup(sessionPlayerId), { type: "checkIn", sessionPlayerId });
}

/** Confirms a player's "I'm leaving" request. */
export async function confirmLeaveRequest(requestId: string): Promise<ActionResult> {
  return run(await dayOfLeave(requestId), { type: "confirmLeave", requestId });
}

export async function declineLeaveRequest(requestId: string): Promise<ActionResult> {
  return run(await dayOfLeave(requestId), { type: "declineLeave", requestId });
}

export async function markPlayerDone(sessionPlayerId: string): Promise<ActionResult> {
  return run(await dayOfSignup(sessionPlayerId), { type: "markDone", sessionPlayerId });
}

export async function requeuePlayer(sessionPlayerId: string): Promise<ActionResult> {
  return run(await dayOfSignup(sessionPlayerId), { type: "requeue", sessionPlayerId });
}

export async function togglePriority(sessionPlayerId: string): Promise<ActionResult> {
  const row = await prisma.sessionPlayer.findUnique({
    where: { id: sessionPlayerId },
    select: { gameDayId: true, priority: true },
  });
  return run(row?.gameDayId, { type: "setPriority", sessionPlayerId, priority: !row?.priority });
}

export async function setPriority(sessionPlayerId: string, priority: boolean): Promise<ActionResult> {
  return run(await dayOfSignup(sessionPlayerId), { type: "setPriority", sessionPlayerId, priority });
}

export async function setPermanentPartner(
  gameDayId: string,
  playerId: string,
  partnerId: string | null,
): Promise<ActionResult> {
  return run(gameDayId, { type: "setPartner", playerId, partnerId });
}

export async function createPairingRequest(
  gameDayId: string,
  playerId: string,
  type: "PAIR_WITH" | "PLAY_AGAINST",
  targetPlayerId: string,
): Promise<ActionResult> {
  return run(gameDayId, { type: "createRequest", playerId, requestType: type, targetPlayerId });
}

export async function deletePairingRequest(id: string): Promise<ActionResult> {
  const row = await prisma.pairingRequest.findUnique({ where: { id }, select: { gameDayId: true } });
  return run(row?.gameDayId, { type: "deleteRequest", requestId: id });
}

/** Auto-pair: games for open courts, or the next game in line when every court is taken. */
export async function generateMatches(
  gameDayId: string,
  slotIndex?: number,
  maxMatches?: number,
  options: GenerateOptions = {},
): Promise<ActionResult<{ matches: number }>> {
  return run(gameDayId, { type: "generate", slotIndex, maxMatches, options });
}

/** "I don't like these pairings": one suggested game, or every one on the courts, redone. */
export async function regenerateMatches(
  gameDayId: string,
  slotIndex?: number,
  matchId?: string,
): Promise<ActionResult<{ matches: number }>> {
  return run(gameDayId, { type: "regenerate", slotIndex, matchId });
}

/** Moves a game in the waiting line to a new place (0 is next up). */
export async function reorderQueuedGame(
  gameDayId: string,
  matchId: string,
  toIndex: number,
): Promise<ActionResult> {
  return run(gameDayId, { type: "reorderQueued", matchId, toIndex });
}

export async function clearSuggestedMatches(gameDayId: string): Promise<ActionResult> {
  return run(gameDayId, { type: "clearSuggested" });
}

export async function startMatch(matchId: string, options: { free?: boolean } = {}): Promise<ActionResult> {
  return run(await dayOfMatch(matchId), { type: "startMatch", matchId, free: options.free });
}

export async function startAllSuggested(
  gameDayId: string,
  options: { free?: boolean } = {},
): Promise<ActionResult<{ started: number }>> {
  return run(gameDayId, { type: "startAll", free: options.free });
}

export async function completeMatch(matchId: string): Promise<ActionResult> {
  return run(await dayOfMatch(matchId), { type: "completeMatch", matchId });
}

/** Undo an accidental "End game". */
export async function restoreMatch(matchId: string): Promise<ActionResult> {
  return run(await dayOfMatch(matchId), { type: "restoreMatch", matchId });
}

export async function cancelMatch(matchId: string): Promise<ActionResult> {
  return run(await dayOfMatch(matchId), { type: "cancelMatch", matchId });
}

/** Count a finished game, make it a free game, or take it off the record. */
export async function setMatchRecord(matchId: string, record: MatchRecord): Promise<ActionResult> {
  return run(await dayOfMatch(matchId), { type: "setMatchRecord", matchId, record });
}

/** Fix who played a finished game. */
export async function editFinishedMatch(
  matchId: string,
  team1: string[],
  team2: string[],
): Promise<ActionResult> {
  return run(await dayOfMatch(matchId), { type: "editFinishedMatch", matchId, team1, team2 });
}

export async function updateMatchPlayers(
  matchId: string,
  team1: string[],
  team2: string[],
): Promise<ActionResult> {
  return run(await dayOfMatch(matchId), { type: "updateLineup", matchId, team1, team2 });
}

export async function updateMatchCourt(matchId: string, courtNumber: number): Promise<ActionResult> {
  return run(await dayOfMatch(matchId), { type: "updateCourt", matchId, courtNumber });
}

/** Add one court mid-session for the time it is used. */
export async function addCourt(
  gameDayId: string,
  slotIndex: number,
  input: { label?: string; from: string; until: string | null },
): Promise<ActionResult<{ slotIndex: number }>> {
  return run(gameDayId, { type: "addCourt", slotIndex, input });
}

/** Remove one court from a block mid-session. */
export async function removeCourt(
  gameDayId: string,
  slotIndex: number,
  court: number,
): Promise<ActionResult> {
  return run(gameDayId, { type: "removeCourt", slotIndex, court });
}

/** Rename a court from the board, in one block or in every block. */
export async function renameCourt(
  gameDayId: string,
  slotIndex: number,
  court: number,
  label: string,
  everyBlock: boolean,
): Promise<ActionResult> {
  return run(gameDayId, { type: "renameCourt", slotIndex, court, label, everyBlock });
}

/** Court-hours for the fee split, superseding the court plan's; null goes back to the plan. */
export async function setCourtHours(gameDayId: string, hours: number | null): Promise<ActionResult> {
  return run(gameDayId, { type: "setCourtHours", hours });
}

/** A flat base fee for every player, or null to split the court cost again. */
export async function setBaseFee(gameDayId: string, amount: number | null): Promise<ActionResult> {
  return run(gameDayId, { type: "setBaseFee", amount });
}

export async function setPayment(sessionPlayerId: string, input: PaymentInput): Promise<ActionResult> {
  return run(await dayOfSignup(sessionPlayerId), { type: "setPayment", sessionPlayerId, input });
}

/** Tick or untick "settled": paid in full and any change handed back. */
export async function setSettled(sessionPlayerId: string, settled: boolean): Promise<ActionResult> {
  return run(await dayOfSignup(sessionPlayerId), { type: "setSettled", sessionPlayerId, settled });
}

export async function markAllPaid(gameDayId: string): Promise<ActionResult<{ updated: number }>> {
  return run(gameDayId, { type: "markAllPaid" });
}

/** Real levels for players still at X, from the board's prompt. */
export async function setPlayerLevels(
  gameDayId: string,
  levels: { playerId: string; level: string }[],
): Promise<ActionResult<{ updated: number }>> {
  return run(gameDayId, { type: "setLevels", levels });
}

/** Place four checked-in players on a court by hand. The first two are Team 1. */
export async function createManualMatch(
  gameDayId: string,
  courtNumber: number,
  playerIds: string[],
): Promise<ActionResult<{ matchId: string }>> {
  return run(gameDayId, { type: "manualMatch", courtNumber, playerIds });
}

/** Move a match to another court (swapping with a game there), or Transfer to Court from Next up. */
export async function moveMatchToCourt(matchId: string, courtNumber: number): Promise<ActionResult> {
  return run(await dayOfMatch(matchId), { type: "moveToCourt", matchId, courtNumber });
}

/** Swap two players between two active matches. */
export async function swapMatchPlayers(
  matchIdA: string,
  playerIdA: string,
  matchIdB: string,
  playerIdB: string,
): Promise<ActionResult> {
  return run(await dayOfMatch(matchIdA), { type: "swapPlayers", matchIdA, playerIdA, matchIdB, playerIdB });
}
