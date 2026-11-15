import type { EngineState } from "./types";

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The state as the database would load it: handled leave requests and the club list dropped,
 * lists in id order. Two states that save the same rows normalize to the same thing.
 */
export function normalizeState(state: EngineState): EngineState {
  return {
    gameDay: state.gameDay,
    players: state.players
      .map((row) => {
        const copy = { ...row };
        delete copy.newPlayer;
        return copy;
      })
      .sort(byId),
    matches: [...state.matches]
      .map((match) => ({
        ...match,
        players: [...match.players].sort((a, b) => a.team - b.team || a.slot - b.slot),
      }))
      .sort(byId),
    leaveRequests: state.leaveRequests.filter((row) => row.status === "PENDING").sort(byId),
    requests: [...state.requests].sort(byId),
  };
}

/** JSON with object keys sorted, so equal values always give the same text (for hashing). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}
