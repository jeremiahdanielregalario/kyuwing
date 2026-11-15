import { fail, ok, type ActionResult } from "@/lib/action-result";
import { createdId, playerById, playerBySession, type OpContext } from "./helpers";
import { blankSignup } from "./players";
import type { EngineState, RosterEntry } from "./types";

function fromRoster(entry: RosterEntry) {
  return {
    playerId: entry.id,
    nickname: entry.nickname,
    fullName: entry.fullName,
    level: entry.level,
    category: entry.category,
    aliases: entry.aliases,
  };
}

export function addPlayer(
  state: EngineState,
  ctx: OpContext,
  playerId: string,
  checkInNow = false,
): ActionResult {
  const entry = state.roster?.find((row) => row.id === playerId);
  if (!entry) return fail("Player not found.");
  if (playerById(state, playerId)) return fail(`${entry.nickname} is already on the sign-up list.`);
  state.players.push({
    ...blankSignup(createdId(ctx, "s"), fromRoster(entry)),
    status: checkInNow ? "WAITING" : "EXPECTED",
    joinedAt: checkInNow ? ctx.at : null,
    queuedAt: checkInNow ? ctx.at : null,
  });
  return ok(checkInNow ? `${entry.nickname} checked in.` : `${entry.nickname} added to sign-ups.`);
}

export function addAllActivePlayers(state: EngineState, ctx: OpContext): ActionResult<{ added: number }> {
  const toAdd = (state.roster ?? []).filter((entry) => entry.active && !playerById(state, entry.id));
  if (toAdd.length === 0) return ok("Every active player is already on the list.", { added: 0 });
  toAdd.forEach((entry, index) =>
    state.players.push(blankSignup(createdId(ctx, `s${index}`), fromRoster(entry))),
  );
  return ok(`${toAdd.length} players added to sign-ups.`, { added: toAdd.length });
}

export function removePlayer(state: EngineState, _ctx: OpContext, sessionPlayerId: string): ActionResult {
  const row = playerBySession(state, sessionPlayerId);
  if (!row) return fail("Sign-up not found.");
  if (row.status === "PLAYING") return fail("Finish the current game before removing this player.");
  for (const other of state.players)
    if (other.permanentPartnerId === row.playerId) other.permanentPartnerId = null;
  state.players = state.players.filter((other) => other.id !== sessionPlayerId);
  state.leaveRequests = state.leaveRequests.filter((request) => request.sessionPlayerId !== sessionPlayerId);
  return ok("Player removed from this game day.");
}

export function setPermanentPartner(
  state: EngineState,
  _ctx: OpContext,
  playerId: string,
  partnerId: string | null,
): ActionResult {
  if (partnerId === playerId) return fail("A player cannot partner with themselves.");
  const ids = [playerId, ...(partnerId ? [partnerId] : [])];
  if (state.players.filter((row) => ids.includes(row.playerId)).length !== ids.length)
    return fail("Both players must be on this game day.");
  for (const row of state.players) {
    // Clear anyone who used to point at either player, and the two themselves.
    if ((row.permanentPartnerId && ids.includes(row.permanentPartnerId)) || ids.includes(row.playerId))
      row.permanentPartnerId = null;
  }
  if (partnerId) {
    playerById(state, playerId)!.permanentPartnerId = partnerId;
    playerById(state, partnerId)!.permanentPartnerId = playerId;
  }
  return ok(partnerId ? "Permanent pair saved." : "Permanent pair cleared.");
}

export function createPairingRequest(
  state: EngineState,
  ctx: OpContext,
  playerId: string,
  type: "PAIR_WITH" | "PLAY_AGAINST",
  targetPlayerId: string,
): ActionResult {
  if (playerId === targetPlayerId) return fail("Pick a different player.");
  if (!playerById(state, playerId) || !playerById(state, targetPlayerId))
    return fail("Both players must be on this game day.");
  const existing = state.requests.find(
    (row) => row.playerId === playerId && row.type === type && row.targetPlayerId === targetPlayerId,
  );
  if (existing) existing.active = true;
  else state.requests.push({ id: createdId(ctx, "r"), playerId, type, targetPlayerId, active: true });
  return ok(type === "PAIR_WITH" ? "Partner request saved." : "Opponent request saved.");
}

export function deletePairingRequest(state: EngineState, _ctx: OpContext, id: string): ActionResult {
  if (!state.requests.some((row) => row.id === id)) return fail("Request not found.");
  state.requests = state.requests.filter((row) => row.id !== id);
  return ok("Request removed.");
}
