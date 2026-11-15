import { fail, ok, type ActionResult } from "@/lib/action-result";
import { canUndoCheckIn } from "@/lib/check-in";
import { QUEUED_COURT } from "@/lib/datetime";
import { isUnrated, parseLevel } from "@/lib/levels";
import { parseCategory } from "@/lib/validation";
import { byCreated, courtNamer, createdId, hasPlayer, playerBySession, type OpContext } from "./helpers";
import type { EnginePlayer, EngineState } from "./types";

export function checkIn(state: EngineState, ctx: OpContext, sessionPlayerId: string): ActionResult {
  const row = playerBySession(state, sessionPlayerId);
  if (!row) return fail("Sign-up not found.");
  if (row.status === "PLAYING") return fail("That player is already on court.");
  row.status = "WAITING";
  row.joinedAt ??= ctx.at;
  row.queuedAt = ctx.at;
  return ok(`${row.nickname} is in the queue.`);
}

/** Takes a check-in back, for a mistake (see `canUndoCheckIn`). */
export function undoCheckIn(state: EngineState, ctx: OpContext, sessionPlayerId: string): ActionResult {
  const row = playerBySession(state, sessionPlayerId);
  if (!row) return fail("Sign-up not found.");
  const lined = state.matches
    .filter((match) => match.status === "SUGGESTED" && hasPlayer(match, row.playerId))
    .sort(byCreated)[0];
  const name = courtNamer(state, ctx.at);
  const verdict = canUndoCheckIn({
    nickname: row.nickname,
    status: row.status,
    gamesPlayed: row.gamesPlayed,
    linedUpFor: lined
      ? lined.courtNumber === QUEUED_COURT
        ? "a waiting game"
        : name(lined.courtNumber)
      : null,
  });
  if (!verdict.allow) return fail(verdict.reason);
  row.status = "EXPECTED";
  row.joinedAt = null;
  row.queuedAt = null;
  // A pending "I'm leaving" request means nothing for someone who is not checked in.
  state.leaveRequests = state.leaveRequests.filter(
    (request) => !(request.sessionPlayerId === row.id && request.status === "PENDING"),
  );
  return ok(`${row.nickname}'s check-in was undone. They are back to expected.`);
}

/**
 * Confirms a player's "I'm leaving" request: marks them done and removes any suggested game
 * they were lined up for, so the other three go back to waiting.
 */
export function confirmLeave(state: EngineState, ctx: OpContext, requestId: string): ActionResult {
  const request = state.leaveRequests.find((row) => row.id === requestId);
  if (!request || request.status !== "PENDING") return fail("That request was already handled.");
  const row = playerBySession(state, request.sessionPlayerId);
  if (!row) return fail("That request was already handled.");
  if (row.status === "PLAYING")
    return fail(`${row.nickname} is in a live game. Finish it first, then confirm.`);

  const lined = state.matches.filter(
    (match) => match.status === "SUGGESTED" && hasPlayer(match, row.playerId),
  );
  const linedIds = new Set(lined.map((match) => match.id));
  state.matches = state.matches.filter((match) => !linedIds.has(match.id));
  row.status = "DONE";
  row.queuedAt = null;
  for (const other of state.leaveRequests) {
    if (other.sessionPlayerId === row.id && other.status === "PENDING") {
      other.status = "CONFIRMED";
      other.resolvedAt = ctx.at;
    }
  }
  return ok(
    lined.length
      ? `${row.nickname} is out. Their suggested game was removed; the others are waiting again.`
      : `${row.nickname} is out for the day.`,
  );
}

export function declineLeave(state: EngineState, ctx: OpContext, requestId: string): ActionResult {
  const request = state.leaveRequests.find((row) => row.id === requestId);
  if (!request || request.status !== "PENDING") return fail("That request was already handled.");
  request.status = "DECLINED";
  request.resolvedAt = ctx.at;
  const row = playerBySession(state, request.sessionPlayerId);
  return ok(`${row?.nickname ?? "They"} stays in the queue.`);
}

export function markDone(state: EngineState, _ctx: OpContext, sessionPlayerId: string): ActionResult {
  const row = playerBySession(state, sessionPlayerId);
  if (!row) return fail("Sign-up not found.");
  if (row.status === "PLAYING") return fail("Finish the current game before marking them done.");
  row.status = "DONE";
  row.queuedAt = null;
  return ok("Marked done for the day.");
}

export function requeue(state: EngineState, ctx: OpContext, sessionPlayerId: string): ActionResult {
  const row = playerBySession(state, sessionPlayerId);
  if (!row) return fail("Sign-up not found.");
  row.status = "WAITING";
  row.queuedAt = ctx.at;
  row.joinedAt ??= ctx.at;
  return ok("Back in the queue.");
}

/**
 * Sets priority on or off. The operation carries the value it sets (not "toggle"), so applying
 * it twice, e.g. while it is still being sent, gives the same answer.
 */
export function setPriority(
  state: EngineState,
  _ctx: OpContext,
  sessionPlayerId: string,
  priority: boolean,
): ActionResult {
  const row = playerBySession(state, sessionPlayerId);
  if (!row) return fail("Sign-up not found.");
  row.priority = priority;
  return ok(priority ? "Marked as priority. They will be seated sooner." : "Priority cleared.");
}

export function blankSignup(
  id: string,
  player: Pick<EnginePlayer, "playerId" | "nickname" | "fullName" | "level" | "category" | "aliases">,
): EnginePlayer {
  return {
    id,
    ...player,
    status: "EXPECTED",
    joinedAt: null,
    queuedAt: null,
    lastPlayedAt: null,
    gamesPlayed: 0,
    permanentPartnerId: null,
    priority: false,
    paid: false,
    amountPaid: 0,
    paymentMethod: null,
    gripCount: 0,
    otherCharge: 0,
    otherNote: null,
    voucher: 0,
    settled: false,
    note: null,
  };
}

/**
 * A walk-in: an existing player by that exact nickname is reused, otherwise a new player is
 * created. They are checked in straight away.
 */
export function addWalkIn(
  state: EngineState,
  ctx: OpContext,
  input: { nickname: string; level: string; category: string },
): ActionResult<{ sessionPlayerId: string }> {
  const nickname = input.nickname.trim();
  const level = parseLevel(input.level);
  const category = parseCategory(input.category);
  if (!nickname) return fail("Enter a nickname.");
  if (!level) return fail("Pick a valid level.");
  if (!category) return fail("Pick a valid player type.");

  const sessionPlayerId = createdId(ctx, "s");
  // Applied already (the same press sent twice): nothing more to do.
  if (playerBySession(state, sessionPlayerId))
    return ok(`${nickname} added as a walk-in.`, { sessionPlayerId });

  const known =
    state.roster?.find((entry) => entry.nickname === nickname) ??
    state.players.find((row) => row.nickname === nickname);
  const player = known
    ? {
        playerId: "playerId" in known ? known.playerId : known.id,
        nickname: known.nickname,
        fullName: known.fullName,
        level: known.level,
        category: known.category,
        aliases: known.aliases,
      }
    : { playerId: createdId(ctx, "p"), nickname, fullName: null, level, category, aliases: [] };

  if (state.players.some((row) => row.playerId === player.playerId))
    return fail(`${nickname} is already on this game day.`);

  state.players.push({
    ...blankSignup(sessionPlayerId, player),
    status: "WAITING",
    joinedAt: ctx.at,
    queuedAt: ctx.at,
    ...(known ? {} : { newPlayer: true }),
  });
  if (!known && state.roster) state.roster.push({ id: player.playerId, ...player, active: true });
  return ok(`${nickname} added as a walk-in.`, { sessionPlayerId });
}

/** Real levels for players still at X, from the board's prompt. */
export function setLevels(
  state: EngineState,
  _ctx: OpContext,
  levels: { playerId: string; level: string }[],
): ActionResult<{ updated: number }> {
  const parsed: { playerId: string; level: string }[] = [];
  for (const row of levels) {
    const level = parseLevel(row.level);
    if (!level || isUnrated(level)) return fail("Pick a level for every player, from E- to A+.");
    if (typeof row.playerId !== "string" || !row.playerId) return fail("Player not found.");
    parsed.push({ playerId: row.playerId, level });
  }
  if (parsed.length === 0) return fail("Pick at least one level.");
  const ids = new Set(parsed.map((row) => row.playerId));
  if (state.players.filter((row) => ids.has(row.playerId)).length !== ids.size)
    return fail("Player not found on this game day.");
  for (const row of parsed) {
    const player = state.players.find((item) => item.playerId === row.playerId);
    if (player) player.level = row.level;
    const entry = state.roster?.find((item) => item.id === row.playerId);
    if (entry) entry.level = row.level;
  }
  return ok(parsed.length === 1 ? "Level saved." : `${parsed.length} levels saved.`, {
    updated: parsed.length,
  });
}
