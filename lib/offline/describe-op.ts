import type { BoardOp } from "@/lib/board-engine/ops";
import type { EngineState } from "@/lib/board-engine/types";

const LABELS: Record<BoardOp["type"], string> = {
  checkIn: "Check in",
  undoCheckIn: "Undo check-in",
  markDone: "Done for the day",
  requeue: "Back in the queue",
  setPriority: "Priority",
  confirmLeave: "Confirm leaving",
  declineLeave: "Decline leaving",
  addWalkIn: "Add walk-in",
  setLevels: "Set levels",
  generate: "Auto-pair",
  regenerate: "Re-pair",
  reorderQueued: "Reorder the queue",
  clearSuggested: "Clear suggested games",
  startMatch: "Start game",
  startAll: "Start all games",
  completeMatch: "Finish game",
  restoreMatch: "Restore game",
  cancelMatch: "Cancel game",
  updateLineup: "Change lineup",
  updateCourt: "Change court",
  manualMatch: "Make a game",
  moveToCourt: "Move to court",
  swapPlayers: "Swap players",
  addCourt: "Add court",
  removeCourt: "Remove court",
  renameCourt: "Rename court",
  setStatus: "Change game day status",
  startGameDay: "Start game day",
  extendGameDay: "Extend game day",
  endGameDay: "End game day",
  setCourtHours: "Court-hours",
  setPayment: "Payment",
  setSettled: "Settled",
  markAllPaid: "Mark all paid",
  addPlayer: "Add player",
  addAllActive: "Add all active players",
  removePlayer: "Remove player",
  setPartner: "Permanent partner",
  createRequest: "Pairing request",
  deleteRequest: "Remove pairing request",
};

/** A short line for a change, e.g. "Payment · Migs", for the list of changes the server refused. */
export function describeOp(op: BoardOp, state: EngineState): string {
  const label = LABELS[op.type] ?? "Change";
  let who: string | undefined;
  if ("sessionPlayerId" in op) who = state.players.find((p) => p.id === op.sessionPlayerId)?.nickname;
  else if (op.type === "addPlayer" || op.type === "setPartner")
    who = state.players.find((p) => p.playerId === op.playerId)?.nickname;
  else if (op.type === "addWalkIn") who = op.input.nickname;
  return who ? `${label} · ${who}` : label;
}
