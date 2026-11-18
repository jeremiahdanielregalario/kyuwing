import { fail, type ActionResult } from "@/lib/action-result";
import type { CourtSetup } from "@/lib/court-setup";
import {
  addCourt,
  endGameDay,
  extendGameDay,
  removeCourt,
  renameCourt,
  setGameDayStatus,
  startGameDay,
} from "./gameday";
import { markAllPaid, setBaseFee, setCourtHours, setPayment, setSettled, type PaymentInput } from "./fees";
import { generateMatches, regenerateMatches, type GenerateOptions } from "./generate";
import type { OpContext } from "./helpers";
import {
  cancelMatch,
  clearSuggestedMatches,
  completeMatch,
  createManualMatch,
  editFinishedMatch,
  moveMatchToCourt,
  reorderQueuedGame,
  restoreMatch,
  setMatchRecord,
  startAllSuggested,
  startMatch,
  swapMatchPlayers,
  updateMatchCourt,
  updateMatchPlayers,
  type MatchRecord,
} from "./matches";
import {
  addWalkIn,
  checkIn,
  confirmLeave,
  declineLeave,
  markDone,
  requeue,
  setLevels,
  setPriority,
  undoCheckIn,
} from "./players";
import {
  addAllActivePlayers,
  addPlayer,
  createPairingRequest,
  deletePairingRequest,
  removePlayer,
  setPermanentPartner,
} from "./signups";
import type { EngineState } from "./types";

/**
 * One press on the board, Fees or Sign-ups, as data. The tablet applies it to its own copy right
 * away and sends it to the server, which applies the very same operation to the database's copy.
 * `id` makes a resend harmless (the server skips ids it has seen) and seeds anything the press
 * creates; `at` is when it was pressed, so start and end times are the tablet's, not the upload's.
 */
export type BoardOp = { id: string; at: number } & BoardOpBody;

export type BoardOpBody =
  | { type: "checkIn"; sessionPlayerId: string }
  | { type: "undoCheckIn"; sessionPlayerId: string }
  | { type: "markDone"; sessionPlayerId: string }
  | { type: "requeue"; sessionPlayerId: string }
  | { type: "setPriority"; sessionPlayerId: string; priority: boolean }
  | { type: "confirmLeave"; requestId: string }
  | { type: "declineLeave"; requestId: string }
  | { type: "addWalkIn"; input: { nickname: string; level: string; category: string } }
  | { type: "setLevels"; levels: { playerId: string; level: string }[] }
  | { type: "generate"; slotIndex?: number; maxMatches?: number; options?: GenerateOptions }
  | { type: "regenerate"; slotIndex?: number; matchId?: string }
  | { type: "reorderQueued"; matchId: string; toIndex: number }
  | { type: "clearSuggested" }
  | { type: "startMatch"; matchId: string; free?: boolean }
  | { type: "startAll"; free?: boolean }
  | { type: "completeMatch"; matchId: string }
  | { type: "restoreMatch"; matchId: string }
  | { type: "cancelMatch"; matchId: string }
  | { type: "setMatchRecord"; matchId: string; record: MatchRecord }
  | { type: "editFinishedMatch"; matchId: string; team1: string[]; team2: string[] }
  | { type: "updateLineup"; matchId: string; team1: string[]; team2: string[] }
  | { type: "updateCourt"; matchId: string; courtNumber: number }
  | { type: "manualMatch"; courtNumber: number; playerIds: string[] }
  | { type: "moveToCourt"; matchId: string; courtNumber: number }
  | { type: "swapPlayers"; matchIdA: string; playerIdA: string; matchIdB: string; playerIdB: string }
  | { type: "addCourt"; slotIndex: number; input: { label?: string; from: string; until: string | null } }
  | { type: "removeCourt"; slotIndex: number; court: number }
  | { type: "renameCourt"; slotIndex: number; court: number; label: string; everyBlock: boolean }
  | { type: "setStatus"; status: "DRAFT" | "LIVE" | "COMPLETED" }
  | { type: "startGameDay"; setup: CourtSetup[] }
  | { type: "extendGameDay"; until: string; courts: number }
  | { type: "endGameDay"; countLiveGames: boolean }
  | { type: "setCourtHours"; hours: number | null }
  | { type: "setBaseFee"; amount: number | null }
  | { type: "setPayment"; sessionPlayerId: string; input: PaymentInput }
  | { type: "setSettled"; sessionPlayerId: string; settled: boolean }
  | { type: "markAllPaid" }
  | { type: "addPlayer"; playerId: string; checkInNow?: boolean }
  | { type: "addAllActive" }
  | { type: "removePlayer"; sessionPlayerId: string }
  | { type: "setPartner"; playerId: string; partnerId: string | null }
  | {
      type: "createRequest";
      playerId: string;
      requestType: "PAIR_WITH" | "PLAY_AGAINST";
      targetPlayerId: string;
    }
  | { type: "deleteRequest"; requestId: string };

export type OpType = BoardOpBody["type"];

/** Operations that look players up in the club's list, so the server loads it first. */
export function needsRoster(op: BoardOpBody): boolean {
  return op.type === "addWalkIn" || op.type === "addPlayer" || op.type === "addAllActive";
}

/** Operations whose success closes the game day, after which attendance is logged. */
export function closesGameDay(op: BoardOpBody): boolean {
  return op.type === "endGameDay" || (op.type === "setStatus" && op.status === "COMPLETED");
}

// The result's data differs by operation; callers know which one they sent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OpResult = ActionResult<any>;

function run(state: EngineState, ctx: OpContext, op: BoardOpBody): OpResult {
  switch (op.type) {
    case "checkIn":
      return checkIn(state, ctx, op.sessionPlayerId);
    case "undoCheckIn":
      return undoCheckIn(state, ctx, op.sessionPlayerId);
    case "markDone":
      return markDone(state, ctx, op.sessionPlayerId);
    case "requeue":
      return requeue(state, ctx, op.sessionPlayerId);
    case "setPriority":
      return setPriority(state, ctx, op.sessionPlayerId, op.priority);
    case "confirmLeave":
      return confirmLeave(state, ctx, op.requestId);
    case "declineLeave":
      return declineLeave(state, ctx, op.requestId);
    case "addWalkIn":
      return addWalkIn(state, ctx, op.input);
    case "setLevels":
      return setLevels(state, ctx, op.levels);
    case "generate":
      return generateMatches(state, ctx, op.slotIndex, op.maxMatches, op.options);
    case "regenerate":
      return regenerateMatches(state, ctx, op.slotIndex, op.matchId);
    case "reorderQueued":
      return reorderQueuedGame(state, ctx, op.matchId, op.toIndex);
    case "clearSuggested":
      return clearSuggestedMatches(state);
    case "startMatch":
      return startMatch(state, ctx, op.matchId, Boolean(op.free));
    case "startAll":
      return startAllSuggested(state, ctx, Boolean(op.free));
    case "completeMatch":
      return completeMatch(state, ctx, op.matchId);
    case "restoreMatch":
      return restoreMatch(state, ctx, op.matchId);
    case "cancelMatch":
      return cancelMatch(state, ctx, op.matchId);
    case "setMatchRecord":
      return setMatchRecord(state, ctx, op.matchId, op.record);
    case "editFinishedMatch":
      return editFinishedMatch(state, ctx, op.matchId, op.team1, op.team2);
    case "updateLineup":
      return updateMatchPlayers(state, ctx, op.matchId, op.team1, op.team2);
    case "updateCourt":
      return updateMatchCourt(state, ctx, op.matchId, op.courtNumber);
    case "manualMatch":
      return createManualMatch(state, ctx, op.courtNumber, op.playerIds);
    case "moveToCourt":
      return moveMatchToCourt(state, ctx, op.matchId, op.courtNumber);
    case "swapPlayers":
      return swapMatchPlayers(state, ctx, op.matchIdA, op.playerIdA, op.matchIdB, op.playerIdB);
    case "addCourt":
      return addCourt(state, ctx, op.slotIndex, op.input);
    case "removeCourt":
      return removeCourt(state, ctx, op.slotIndex, op.court);
    case "renameCourt":
      return renameCourt(state, ctx, op.slotIndex, op.court, op.label, op.everyBlock);
    case "setStatus":
      return setGameDayStatus(state, ctx, op.status);
    case "startGameDay":
      return startGameDay(state, ctx, op.setup);
    case "extendGameDay":
      return extendGameDay(state, ctx, op.until, op.courts);
    case "endGameDay":
      return endGameDay(state, ctx, op.countLiveGames);
    case "setCourtHours":
      return setCourtHours(state, ctx, op.hours);
    case "setBaseFee":
      return setBaseFee(state, ctx, op.amount);
    case "setPayment":
      return setPayment(state, ctx, op.sessionPlayerId, op.input);
    case "setSettled":
      return setSettled(state, ctx, op.sessionPlayerId, op.settled);
    case "markAllPaid":
      return markAllPaid(state);
    case "addPlayer":
      return addPlayer(state, ctx, op.playerId, op.checkInNow);
    case "addAllActive":
      return addAllActivePlayers(state, ctx);
    case "removePlayer":
      return removePlayer(state, ctx, op.sessionPlayerId);
    case "setPartner":
      return setPermanentPartner(state, ctx, op.playerId, op.partnerId);
    case "createRequest":
      return createPairingRequest(state, ctx, op.playerId, op.requestType, op.targetPlayerId);
    case "deleteRequest":
      return deletePairingRequest(state, ctx, op.requestId);
    default:
      return fail("This change isn't supported. Reload the page.");
  }
}

/**
 * Applies one operation. Returns the new state (the same object when the operation was refused)
 * and the answer to show. The input state is never changed.
 */
export function applyOp(state: EngineState, op: BoardOp): { state: EngineState; result: OpResult } {
  const next = structuredClone(state);
  let result: OpResult;
  try {
    result = run(next, { id: op.id, at: op.at }, op);
  } catch (error) {
    result = fail(error instanceof Error ? error.message : "Something went wrong with that change.");
  }
  return result.ok ? { state: next, result } : { state, result };
}

/** Applies operations in order, skipping refused ones. */
export function applyOps(state: EngineState, ops: BoardOp[]): EngineState {
  return ops.reduce((current, op) => applyOp(current, op).state, state);
}
