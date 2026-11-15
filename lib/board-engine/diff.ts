import type {
  EngineGameDay,
  EngineLeaveRequest,
  EngineMatch,
  EnginePairingRequest,
  EnginePlayer,
  EngineState,
} from "./types";

/** Sign-up fields saved on SessionPlayer. */
export const SESSION_FIELDS = [
  "status",
  "joinedAt",
  "queuedAt",
  "lastPlayedAt",
  "gamesPlayed",
  "permanentPartnerId",
  "priority",
  "paid",
  "amountPaid",
  "paymentMethod",
  "gripCount",
  "otherCharge",
  "otherNote",
  "voucher",
  "settled",
  "note",
] as const satisfies readonly (keyof EnginePlayer)[];

/** Game-day fields the engine changes. */
export const GAMEDAY_FIELDS = [
  "status",
  "courtPlan",
  "startedAt",
  "completedAt",
  "courtHoursOverride",
] as const satisfies readonly (keyof EngineGameDay)[];

export const MATCH_FIELDS = [
  "courtNumber",
  "round",
  "status",
  "free",
  "rejected",
  "note",
  "startedAt",
  "endedAt",
  "createdAt",
  "updatedAt",
] as const satisfies readonly (keyof EngineMatch)[];

type Changed<T, K extends keyof T> = { id: string; data: Partial<Pick<T, K>> };

/** What to write to the database to turn `before` into `after`. */
export type ChangeSet = {
  gameDay: Partial<Pick<EngineGameDay, (typeof GAMEDAY_FIELDS)[number]>> | null;
  newPlayers: EnginePlayer[];
  levels: { playerId: string; level: string }[];
  createdSignups: EnginePlayer[];
  updatedSignups: Changed<EnginePlayer, (typeof SESSION_FIELDS)[number]>[];
  deletedSignups: string[];
  createdMatches: EngineMatch[];
  updatedMatches: (Changed<EngineMatch, (typeof MATCH_FIELDS)[number]> & {
    players: EngineMatch["players"] | null;
  })[];
  deletedMatches: string[];
  updatedLeaves: Changed<EngineLeaveRequest, "status" | "resolvedAt">[];
  deletedLeaves: string[];
  createdRequests: EnginePairingRequest[];
  updatedRequests: Changed<EnginePairingRequest, "active">[];
  deletedRequests: string[];
};

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function picked<T, K extends keyof T>(before: T, after: T, fields: readonly K[]): Partial<Pick<T, K>> | null {
  const data: Partial<Pick<T, K>> = {};
  let any = false;
  for (const field of fields) {
    if (!same(before[field], after[field])) {
      data[field] = after[field];
      any = true;
    }
  }
  return any ? data : null;
}

function lineup(players: EngineMatch["players"]): string {
  return [...players]
    .sort((a, b) => a.team - b.team || a.slot - b.slot)
    .map((row) => `${row.team}:${row.slot}:${row.playerId}`)
    .join(",");
}

export function diffStates(before: EngineState, after: EngineState): ChangeSet {
  const change: ChangeSet = {
    gameDay: picked(before.gameDay, after.gameDay, GAMEDAY_FIELDS),
    newPlayers: [],
    levels: [],
    createdSignups: [],
    updatedSignups: [],
    deletedSignups: [],
    createdMatches: [],
    updatedMatches: [],
    deletedMatches: [],
    updatedLeaves: [],
    deletedLeaves: [],
    createdRequests: [],
    updatedRequests: [],
    deletedRequests: [],
  };

  const oldSignups = new Map(before.players.map((row) => [row.id, row]));
  for (const row of after.players) {
    const old = oldSignups.get(row.id);
    if (!old) {
      if (row.newPlayer) change.newPlayers.push(row);
      change.createdSignups.push(row);
      continue;
    }
    if (old.level !== row.level) change.levels.push({ playerId: row.playerId, level: row.level });
    const data = picked(old, row, SESSION_FIELDS);
    if (data) change.updatedSignups.push({ id: row.id, data });
  }
  const kept = new Set(after.players.map((row) => row.id));
  change.deletedSignups = before.players.filter((row) => !kept.has(row.id)).map((row) => row.id);

  const oldMatches = new Map(before.matches.map((match) => [match.id, match]));
  for (const match of after.matches) {
    const old = oldMatches.get(match.id);
    if (!old) {
      change.createdMatches.push(match);
      continue;
    }
    const data = picked(old, match, MATCH_FIELDS);
    const players = lineup(old.players) === lineup(match.players) ? null : match.players;
    if (data || players) change.updatedMatches.push({ id: match.id, data: data ?? {}, players });
  }
  const keptMatches = new Set(after.matches.map((match) => match.id));
  change.deletedMatches = before.matches
    .filter((match) => !keptMatches.has(match.id))
    .map((match) => match.id);

  const oldLeaves = new Map(before.leaveRequests.map((row) => [row.id, row]));
  for (const row of after.leaveRequests) {
    const old = oldLeaves.get(row.id);
    const data = old ? picked(old, row, ["status", "resolvedAt"] as const) : null;
    if (data) change.updatedLeaves.push({ id: row.id, data });
  }
  const keptLeaves = new Set(after.leaveRequests.map((row) => row.id));
  change.deletedLeaves = before.leaveRequests.filter((row) => !keptLeaves.has(row.id)).map((row) => row.id);

  const oldRequests = new Map(before.requests.map((row) => [row.id, row]));
  for (const row of after.requests) {
    const old = oldRequests.get(row.id);
    if (!old) change.createdRequests.push(row);
    else if (old.active !== row.active)
      change.updatedRequests.push({ id: row.id, data: { active: row.active } });
  }
  const keptRequests = new Set(after.requests.map((row) => row.id));
  change.deletedRequests = before.requests.filter((row) => !keptRequests.has(row.id)).map((row) => row.id);

  return change;
}

export function isEmptyChange(change: ChangeSet): boolean {
  return (
    change.gameDay === null &&
    Object.entries(change).every(
      ([key, value]) => key === "gameDay" || (Array.isArray(value) && value.length === 0),
    )
  );
}
