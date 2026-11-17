import { courtName, currentSlotIndex, openCourts, QUEUED_COURT, type CourtSlot } from "@/lib/datetime";
import type { EngineMatch, EnginePlayer, EngineState } from "./types";

/** When and as what an operation runs: its id (for anything it creates) and the press time. */
export type OpContext = { id: string; at: number };

/** The court block in play at `at`, or undefined with no plan. */
export function slotAt(plan: CourtSlot[], at: number): CourtSlot | undefined {
  return plan.length ? plan[currentSlotIndex(plan, new Date(at))] : undefined;
}

/** Index of the court block in play at `at` (0 with no plan). */
export function slotIndexAt(plan: CourtSlot[], at: number): number {
  return plan.length ? currentSlotIndex(plan, new Date(at)) : 0;
}

/**
 * Display names for a game day's courts in its current block ("Court 5" when the block's courts
 * are labelled 5-8, "Next up" for the waiting line), so messages match the board.
 */
export function courtNamer(state: EngineState, at: number): (court: number) => string {
  const slot = slotAt(state.gameDay.courtPlan, at);
  return (court) => courtName(slot, court);
}

export function isActive(match: EngineMatch): boolean {
  return match.status === "SUGGESTED" || match.status === "LIVE";
}

export function hasPlayer(match: EngineMatch, playerId: string): boolean {
  return match.players.some((row) => row.playerId === playerId);
}

/** Oldest first, the order of the Next up line (ties by id, as the database sorts them). */
export function byCreated(a: EngineMatch, b: EngineMatch): number {
  return a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** The Next up line, oldest first. */
export function waitingLine(state: EngineState): EngineMatch[] {
  return state.matches
    .filter((match) => match.status === "SUGGESTED" && match.courtNumber === QUEUED_COURT)
    .sort(byCreated);
}

/**
 * Next up games whose four players are all off court, oldest first: the ones the queue master
 * can transfer onto a free court now. A planned game can include players still playing.
 */
export function readyQueuedGames(state: EngineState): EngineMatch[] {
  const line = waitingLine(state);
  if (line.length === 0) return [];
  const playing = new Set(
    state.matches
      .filter((match) => match.status === "LIVE")
      .flatMap((match) => match.players.map((row) => row.playerId)),
  );
  return line.filter((game) => !game.players.some((row) => playing.has(row.playerId)));
}

/** The note added when a court just came free and a Next up game is ready for it. */
export function transferHint(state: EngineState): string {
  return readyQueuedGames(state).length > 0 ? " A Next up game is ready: press Transfer to Court on it." : "";
}

/**
 * Moves ready Next up games onto open courts of the current block, oldest first (only
 * Auto-pair does this). Returns the courts that received a game.
 */
export function promoteQueuedGames(state: EngineState, at: number, slotIndex?: number): number[] {
  const queued = readyQueuedGames(state);
  if (queued.length === 0) return [];
  const plan = state.gameDay.courtPlan;
  if (plan.length === 0) return [];
  const total = (plan[slotIndex ?? -1] ?? plan[currentSlotIndex(plan, new Date(at))]).courts;
  const busy = state.matches
    .filter((match) => isActive(match) && match.courtNumber !== QUEUED_COURT)
    .map((match) => match.courtNumber);
  const open = openCourts(total, busy);
  const filled: number[] = [];
  for (const [index, match] of queued.entries()) {
    const court = open[index];
    if (court === undefined) break;
    match.courtNumber = court;
    match.updatedAt = at;
    filled.push(court);
  }
  return filled;
}

export function playerBySession(state: EngineState, sessionPlayerId: string): EnginePlayer | undefined {
  return state.players.find((row) => row.id === sessionPlayerId);
}

export function playerById(state: EngineState, playerId: string): EnginePlayer | undefined {
  return state.players.find((row) => row.playerId === playerId);
}

/** Sets fields on the sign-ups of these players (by player id). */
export function updatePlayers(
  state: EngineState,
  playerIds: Iterable<string>,
  change: Partial<EnginePlayer>,
) {
  const ids = new Set(playerIds);
  for (const row of state.players) if (ids.has(row.playerId)) Object.assign(row, change);
}

export function nextRound(state: EngineState): number {
  return Math.max(0, ...state.matches.map((match) => match.round)) + 1;
}

/** A new suggested game. */
export function newMatch(
  id: string,
  at: number,
  courtNumber: number,
  round: number,
  team1: string[],
  team2: string[],
  extra: Partial<EngineMatch> = {},
): EngineMatch {
  return {
    id,
    courtNumber,
    round,
    status: "SUGGESTED",
    free: false,
    rejected: [],
    note: null,
    startedAt: null,
    endedAt: null,
    createdAt: at,
    updatedAt: at,
    players: [
      ...team1.map((playerId, index) => ({ playerId, team: 1, slot: index + 1 })),
      ...team2.map((playerId, index) => ({ playerId, team: 2, slot: index + 1 })),
    ],
    ...extra,
  };
}

/** A repeatable number in [0, 2^31) from an operation id, for "Regenerate" variety. */
export function seedFrom(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 ** 31;
}

/** Ids for things an operation creates: the same on the tablet and the server. */
export function createdId(ctx: OpContext, suffix: string | number): string {
  return `${ctx.id}-${suffix}`;
}

/**
 * A game that was played and is over: finished normally, or taken off the record ("not
 * recorded", stored as CANCELLED with its start and end times). Cancelled plans that never
 * started have no start time and are not games.
 */
export function isFinishedGame(match: EngineMatch): boolean {
  return (
    match.status === "COMPLETED" ||
    (match.status === "CANCELLED" && match.startedAt !== null && match.endedAt !== null)
  );
}
