import { fail, type ActionResult } from "@/lib/action-result";
import type { PaymentInput } from "@/lib/board-engine/fees";
import type { GenerateOptions } from "@/lib/board-engine/generate";
import type { BoardOpBody, OpResult } from "@/lib/board-engine/ops";
import type { EngineState } from "@/lib/board-engine/types";
import type { CourtSetup } from "@/lib/court-setup";

type Run = (body: BoardOpBody) => OpResult;

/**
 * The board's, Fees' and Sign-ups' changes, made on this device (see GameDaySync). Same names and
 * arguments as the server actions in lib/actions/gamedays.ts, so the pages call them the same way;
 * the answer comes back at once and the change is sent in the background.
 */
export function makeGameDayActions(gameDayId: string, run: Run, current: () => EngineState) {
  const go = <T = undefined>(body: BoardOpBody) => Promise.resolve(run(body) as ActionResult<T>);
  /** For whole-game-day presses: only this game day's copy is kept here. */
  const forDay = <T = undefined>(id: string, body: BoardOpBody) =>
    id === gameDayId
      ? go<T>(body)
      : Promise.resolve(fail("Open that game day to change it.") as ActionResult<T>);
  return {
    setGameDayStatus: (_id: string, status: "DRAFT" | "LIVE" | "COMPLETED") =>
      go({ type: "setStatus", status }),
    startGameDay: (_id: string, setup: CourtSetup[]) => go({ type: "startGameDay", setup }),
    extendGameDay: (_id: string, until: string, courts: number) =>
      go({ type: "extendGameDay", until, courts }),
    endGameDay: (_id: string, countLiveGames: boolean) => go({ type: "endGameDay", countLiveGames }),
    addPlayerToGameDay: (_id: string, playerId: string, checkInNow = false) =>
      go({ type: "addPlayer", playerId, checkInNow }),
    addAllActivePlayers: (id: string) => forDay<{ added: number }>(id, { type: "addAllActive" }),
    addWalkIn: (_id: string, input: { nickname: string; level: string; category: string }) =>
      go<{ sessionPlayerId: string }>({ type: "addWalkIn", input }),
    removePlayerFromGameDay: (sessionPlayerId: string) => go({ type: "removePlayer", sessionPlayerId }),
    undoCheckIn: (sessionPlayerId: string) => go({ type: "undoCheckIn", sessionPlayerId }),
    checkInPlayer: (sessionPlayerId: string) => go({ type: "checkIn", sessionPlayerId }),
    confirmLeaveRequest: (requestId: string) => go({ type: "confirmLeave", requestId }),
    declineLeaveRequest: (requestId: string) => go({ type: "declineLeave", requestId }),
    markPlayerDone: (sessionPlayerId: string) => go({ type: "markDone", sessionPlayerId }),
    requeuePlayer: (sessionPlayerId: string) => go({ type: "requeue", sessionPlayerId }),
    togglePriority: (sessionPlayerId: string) =>
      go({
        type: "setPriority",
        sessionPlayerId,
        priority: !current().players.find((row) => row.id === sessionPlayerId)?.priority,
      }),
    setPermanentPartner: (_id: string, playerId: string, partnerId: string | null) =>
      go({ type: "setPartner", playerId, partnerId }),
    createPairingRequest: (
      _id: string,
      playerId: string,
      type: "PAIR_WITH" | "PLAY_AGAINST",
      targetPlayerId: string,
    ) => go({ type: "createRequest", playerId, requestType: type, targetPlayerId }),
    deletePairingRequest: (id: string) => go({ type: "deleteRequest", requestId: id }),
    generateMatches: (_id: string, slotIndex?: number, maxMatches?: number, options: GenerateOptions = {}) =>
      go<{ matches: number }>({ type: "generate", slotIndex, maxMatches, options }),
    regenerateMatches: (_id: string, slotIndex?: number, matchId?: string) =>
      go<{ matches: number }>({ type: "regenerate", slotIndex, matchId }),
    reorderQueuedGame: (_id: string, matchId: string, toIndex: number) =>
      go({ type: "reorderQueued", matchId, toIndex }),
    clearSuggestedMatches: (id: string) => forDay(id, { type: "clearSuggested" }),
    startMatch: (matchId: string, options: { free?: boolean } = {}) =>
      go({ type: "startMatch", matchId, free: options.free }),
    startAllSuggested: (_id: string, options: { free?: boolean } = {}) =>
      go<{ started: number }>({ type: "startAll", free: options.free }),
    completeMatch: (matchId: string) => go({ type: "completeMatch", matchId }),
    restoreMatch: (matchId: string) => go({ type: "restoreMatch", matchId }),
    cancelMatch: (matchId: string) => go({ type: "cancelMatch", matchId }),
    updateMatchPlayers: (matchId: string, team1: string[], team2: string[]) =>
      go({ type: "updateLineup", matchId, team1, team2 }),
    updateMatchCourt: (matchId: string, courtNumber: number) =>
      go({ type: "updateCourt", matchId, courtNumber }),
    addCourt: (
      _id: string,
      slotIndex: number,
      input: { label?: string; from: string; until: string | null },
    ) => go<{ slotIndex: number }>({ type: "addCourt", slotIndex, input }),
    removeCourt: (_id: string, slotIndex: number, court: number) =>
      go({ type: "removeCourt", slotIndex, court }),
    renameCourt: (_id: string, slotIndex: number, court: number, label: string, everyBlock: boolean) =>
      go({ type: "renameCourt", slotIndex, court, label, everyBlock }),
    setCourtHours: (_id: string, hours: number | null) => go({ type: "setCourtHours", hours }),
    setPayment: (sessionPlayerId: string, input: PaymentInput) =>
      go({ type: "setPayment", sessionPlayerId, input }),
    setSettled: (sessionPlayerId: string, settled: boolean) =>
      go({ type: "setSettled", sessionPlayerId, settled }),
    markAllPaid: (id: string) => forDay<{ updated: number }>(id, { type: "markAllPaid" }),
    setPlayerLevels: (_id: string, levels: { playerId: string; level: string }[]) =>
      go<{ updated: number }>({ type: "setLevels", levels }),
    createManualMatch: (_id: string, courtNumber: number, playerIds: string[]) =>
      go<{ matchId: string }>({ type: "manualMatch", courtNumber, playerIds }),
    moveMatchToCourt: (matchId: string, courtNumber: number) =>
      go({ type: "moveToCourt", matchId, courtNumber }),
    swapMatchPlayers: (matchIdA: string, playerIdA: string, matchIdB: string, playerIdB: string) =>
      go({ type: "swapPlayers", matchIdA, playerIdA, matchIdB, playerIdB }),
    gameDayId,
  };
}

export type GameDayActions = ReturnType<typeof makeGameDayActions>;
