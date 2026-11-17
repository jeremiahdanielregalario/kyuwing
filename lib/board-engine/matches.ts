import { fail, ok, type ActionResult } from "@/lib/action-result";
import { formatClock, openCourts, QUEUED_COURT } from "@/lib/datetime";
import { isUnrated } from "@/lib/levels";
import { GAME_MINUTES, lineTimes, moveInLine } from "@/lib/planning";
import {
  courtNamer,
  createdId,
  hasPlayer,
  isActive,
  isFinishedGame,
  nextRound,
  newMatch,
  playerById,
  slotAt,
  transferHint,
  updatePlayers,
  waitingLine,
  type OpContext,
} from "./helpers";
import type { EngineMatch, EngineState } from "./types";

function findMatch(state: EngineState, matchId: string): EngineMatch | undefined {
  return state.matches.find((match) => match.id === matchId);
}

function nicknameOf(state: EngineState, playerId: string): string {
  return playerById(state, playerId)?.nickname ?? "A player";
}

/** A game cannot start while one of its players is still level X (not rated yet). */
function unratedIn(state: EngineState, matches: EngineMatch[]) {
  const names = [
    ...new Set(
      matches.flatMap((match) =>
        match.players
          .map((row) => playerById(state, row.playerId))
          .filter((player) => player && isUnrated(player.level))
          .map((player) => player!.nickname),
      ),
    ),
  ];
  if (names.length === 0) return null;
  return fail(
    `Set a level for ${names.join(", ")} before the game starts. X means their level is not known yet.`,
    "UNRATED_PLAYERS",
  );
}

export function startMatch(state: EngineState, ctx: OpContext, matchId: string, free = false): ActionResult {
  const match = findMatch(state, matchId);
  if (!match) return fail("Match not found.");
  const name = courtNamer(state, ctx.at);
  if (match.status !== "SUGGESTED") return fail("This match is not waiting to start.");
  const unrated = unratedIn(state, [match]);
  if (unrated) return unrated;

  const others = state.matches.filter((other) => isActive(other) && other.id !== matchId);
  // Planning ahead lets a player sit in several waiting or suggested games. The one thing that
  // cannot happen is being on two playing courts at once, so only a live game blocks the start.
  const playingNow = new Map<string, { court: number; startedAt: number | null }>();
  for (const other of others) {
    if (other.status !== "LIVE") continue;
    for (const row of other.players)
      playingNow.set(row.playerId, { court: other.courtNumber, startedAt: other.startedAt });
  }
  const byCourt = new Map<number, { startedAt: number | null; nicknames: string[] }>();
  for (const row of match.players) {
    const live = playingNow.get(row.playerId);
    if (!live) continue;
    const entry = byCourt.get(live.court) ?? { startedAt: live.startedAt, nicknames: [] };
    entry.nicknames.push(nicknameOf(state, row.playerId));
    byCourt.set(live.court, entry);
  }
  const clashed: string[] = [];
  for (const [liveCourt, entry] of byCourt) {
    const until = entry.startedAt
      ? ` (expected to finish about ${formatClock(new Date(entry.startedAt + GAME_MINUTES * 60_000))})`
      : "";
    clashed.push(
      `${entry.nicknames.join(" and ")} ${entry.nicknames.length === 1 ? "is" : "are"} still playing on ${name(liveCourt)}${until}`,
    );
  }
  if (clashed.length > 0)
    return fail(
      `${clashed.join("; ")}. Nobody can be on two playing courts at once. Re-pair this game with someone else, or wait for that game to finish.`,
      "PLAYER_STILL_PLAYING",
    );

  let court = match.courtNumber;
  if (court === QUEUED_COURT) {
    const total = slotAt(state.gameDay.courtPlan, ctx.at)?.courts ?? 0;
    const open = openCourts(
      total,
      others.map((other) => other.courtNumber),
    );
    if (open.length === 0) return fail("Every court is in use. This game starts when a court frees up.");
    court = open[0];
  }

  Object.assign(match, { status: "LIVE", startedAt: ctx.at, courtNumber: court, free, updatedAt: ctx.at });
  updatePlayers(
    state,
    match.players.map((row) => row.playerId),
    { status: "PLAYING" },
  );
  return ok(free ? `${name(court)} is live — free game, not counted.` : `${name(court)} is live.`);
}

export function startAllSuggested(
  state: EngineState,
  ctx: OpContext,
  free = false,
): ActionResult<{ started: number }> {
  const name = courtNamer(state, ctx.at);
  const matches = state.matches.filter(
    (match) => match.status === "SUGGESTED" && match.courtNumber !== QUEUED_COURT,
  );
  if (matches.length === 0) return fail("There are no suggested matches on a court to start.");
  const unrated = unratedIn(state, matches);
  if (unrated) return unrated;

  // Guard against stale duplicate suggestions: one player cannot start twice.
  const claimed = new Map<string, number>();
  for (const other of state.matches.filter((match) => match.status === "LIVE")) {
    for (const row of other.players) claimed.set(row.playerId, other.courtNumber);
  }
  const duplicates: string[] = [];
  for (const match of matches) {
    for (const row of match.players) {
      const court = claimed.get(row.playerId);
      if (court !== undefined) duplicates.push(`${nicknameOf(state, row.playerId)} (${name(court)})`);
      else claimed.set(row.playerId, match.courtNumber);
    }
  }
  if (duplicates.length > 0)
    return fail(
      `Suggestions share players: ${duplicates.join(", ")}. Clear suggestions, then auto-pair again.`,
    );

  for (const match of matches)
    Object.assign(match, { status: "LIVE", startedAt: ctx.at, free, updatedAt: ctx.at });
  updatePlayers(
    state,
    matches.flatMap((match) => match.players.map((row) => row.playerId)),
    { status: "PLAYING" },
  );
  return ok(
    `${matches.length} ${matches.length === 1 ? "court" : "courts"} started${free ? " as free games" : ""}.`,
    {
      started: matches.length,
    },
  );
}

export function completeMatch(state: EngineState, ctx: OpContext, matchId: string): ActionResult {
  const match = findMatch(state, matchId);
  if (!match) return fail("Match not found.");
  const name = courtNamer(state, ctx.at);
  if (match.status !== "LIVE") return fail("Start the match before finishing it.");

  Object.assign(match, { status: "COMPLETED", endedAt: ctx.at, updatedAt: ctx.at });
  const ids = new Set(match.players.map((row) => row.playerId));
  for (const row of state.players) {
    if (!ids.has(row.playerId)) continue;
    row.status = "WAITING";
    // A free game (used shuttle near closing) is played but not counted or billed.
    if (!match.free) row.gamesPlayed += 1;
    row.lastPlayedAt = ctx.at;
    row.queuedAt = ctx.at;
  }
  return ok(
    `${name(match.courtNumber)} finished${match.free ? " (free game, not counted)" : ""}. Players are back in the queue.${transferHint(state)}`,
  );
}

/**
 * Undo an accidental "End game": the match goes back on its court as live (keeping its start
 * time) and the four go back on court with their game counts restored. A waiting game moved onto
 * the freed court returns to the front of the waiting line.
 */
export function restoreMatch(state: EngineState, ctx: OpContext, matchId: string): ActionResult {
  const match = findMatch(state, matchId);
  if (!match) return fail("Match not found.");
  if (match.status !== "COMPLETED") return fail("Only finished games can be restored.");
  if (state.gameDay.status === "COMPLETED") return fail("This game day is already closed.");

  const name = courtNamer(state, ctx.at);
  const court = match.courtNumber;
  const courtsNow = slotAt(state.gameDay.courtPlan, ctx.at)?.courts ?? 0;
  if (court < 1 || court > courtsNow)
    return fail(`${name(court)} isn't in the current block anymore, so this game can't go back on it.`);

  const others = state.matches.filter(isActive);
  const onCourt = others.find((other) => other.courtNumber === court);
  if (onCourt?.status === "LIVE")
    return fail(`${name(court)} already has another game in progress. Finish or cancel it first.`);

  const playerIds = new Set(match.players.map((row) => row.playerId));
  const taken = others.flatMap((other) =>
    other.players
      .filter((row) => playerIds.has(row.playerId))
      .map((row) => `${nicknameOf(state, row.playerId)} (${name(other.courtNumber)})`),
  );
  if (taken.length > 0)
    return fail(`Already in another game: ${taken.join(", ")}. Remove them from it first.`);

  const unavailable = match.players
    .filter((row) => playerById(state, row.playerId)?.status !== "WAITING")
    .map((row) => nicknameOf(state, row.playerId));
  if (unavailable.length > 0)
    return fail(`${unavailable.join(", ")} left the queue since this game ended, so it can't be restored.`);

  if (onCourt) Object.assign(onCourt, { courtNumber: QUEUED_COURT, updatedAt: ctx.at });
  Object.assign(match, { status: "LIVE", endedAt: null, updatedAt: ctx.at });
  for (const row of state.players) {
    if (!playerIds.has(row.playerId)) continue;
    row.status = "PLAYING";
    if (!match.free && row.gamesPlayed > 0) row.gamesPlayed -= 1;
  }
  return ok(
    onCourt
      ? `${name(court)} restored — the game continues. The next game went back to the waiting courts.`
      : `${name(court)} restored — the game continues.`,
  );
}

export function cancelMatch(state: EngineState, ctx: OpContext, matchId: string): ActionResult {
  const match = findMatch(state, matchId);
  if (!match) return fail("Match not found.");
  if (match.status === "COMPLETED") return fail("Completed matches cannot be cancelled.");
  const wasLive = match.status === "LIVE";
  Object.assign(match, { status: "CANCELLED", endedAt: ctx.at, updatedAt: ctx.at });
  // A cancelled game was not played: everyone keeps their place in line (their wait carries on).
  if (wasLive)
    updatePlayers(
      state,
      match.players.map((row) => row.playerId),
      { status: "WAITING" },
    );
  const hint = match.courtNumber === QUEUED_COURT ? "" : transferHint(state);
  return ok(`Match cancelled. Players keep their place in line.${hint}`);
}

export function updateMatchPlayers(
  state: EngineState,
  ctx: OpContext,
  matchId: string,
  team1: string[],
  team2: string[],
): ActionResult {
  if (team1.length !== 2 || team2.length !== 2) return fail("Each team needs exactly two players.");
  const all = [...team1, ...team2];
  if (new Set(all).size !== 4) return fail("A player cannot appear twice in one match.");

  const match = findMatch(state, matchId);
  if (!match) return fail("Match not found.");
  const name = courtNamer(state, ctx.at);
  if (match.status === "COMPLETED" || match.status === "CANCELLED")
    return fail("This match can no longer be edited.");

  const sessionRows = all.map((id) => playerById(state, id)).filter((row) => row !== undefined);
  if (sessionRows.length !== 4) return fail("All four players must be checked into this game day.");

  // A player standing on another court cannot be pulled into this one.
  const committed = new Map<string, number>();
  for (const other of state.matches) {
    if (!isActive(other) || other.id === matchId || other.courtNumber === QUEUED_COURT) continue;
    for (const row of other.players) committed.set(row.playerId, other.courtNumber);
  }
  // Games in the waiting line are plans, so they never block a lineup, and a planned game can
  // use players already elsewhere. Only real courts claim a player.
  if (match.courtNumber !== QUEUED_COURT) {
    const taken = all.find((playerId) => committed.has(playerId));
    if (taken)
      return fail(`${nicknameOf(state, taken)} is already queued for ${name(committed.get(taken)!)}.`);
  } else {
    const notIn = sessionRows.find((row) => row.status === "EXPECTED" || row.status === "DONE");
    if (notIn) return fail(`${notIn.nickname} is not on the board (${notIn.status.toLowerCase()}).`);
  }

  // Someone taken off a live game did not play it, so they keep their place in line.
  if (match.status === "LIVE")
    updatePlayers(
      state,
      match.players.map((row) => row.playerId),
      { status: "WAITING" },
    );
  match.players = [
    ...team1.map((playerId, index) => ({ playerId, team: 1, slot: index + 1 })),
    ...team2.map((playerId, index) => ({ playerId, team: 2, slot: index + 1 })),
  ];
  match.updatedAt = ctx.at;
  if (match.status === "LIVE") updatePlayers(state, all, { status: "PLAYING" });
  return ok("Match line-up updated.");
}

export function updateMatchCourt(
  state: EngineState,
  ctx: OpContext,
  matchId: string,
  courtNumber: number,
): ActionResult {
  if (!Number.isInteger(courtNumber) || courtNumber < 1 || courtNumber > 20)
    return fail("Pick a valid court.");
  const match = findMatch(state, matchId);
  if (!match) return fail("Match not found.");
  const name = courtNamer(state, ctx.at);
  if (match.status === "COMPLETED") return fail("Completed matches cannot be moved.");
  const clash = state.matches.find(
    (other) => other.courtNumber === courtNumber && isActive(other) && other.id !== matchId,
  );
  if (clash) return fail(`${name(courtNumber)} already has a match.`);
  match.courtNumber = courtNumber;
  match.updatedAt = ctx.at;
  return ok(`Moved to ${name(courtNumber)}.`);
}

/** Four checked-in players placed on a court by hand: the first two are Team 1. */
export function createManualMatch(
  state: EngineState,
  ctx: OpContext,
  courtNumber: number,
  playerIds: string[],
): ActionResult<{ matchId: string }> {
  // QUEUED_COURT (0) builds the game in the waiting court instead of on a court.
  if (!Number.isInteger(courtNumber) || courtNumber < QUEUED_COURT || courtNumber > 20)
    return fail("Pick a valid court.");
  if (playerIds.length !== 4 || new Set(playerIds).size !== 4)
    return fail("A court needs four different players.");
  if (state.gameDay.status === "COMPLETED") return fail("This game day is already closed.");
  const name = courtNamer(state, ctx.at);
  const matchId = createdId(ctx, 0);
  if (findMatch(state, matchId)) return ok(`${name(courtNumber)} set by hand.`, { matchId });

  // A waiting-court game is planned ahead, so players still on court can be in it. A real court
  // starts soon, so it takes only players who are waiting.
  const planning = courtNumber === QUEUED_COURT;
  const eligible = new Set(
    state.players
      .filter((row) => row.status === "WAITING" || (planning && row.status === "PLAYING"))
      .map((row) => row.playerId),
  );
  if (playerIds.some((playerId) => !eligible.has(playerId)))
    return fail(
      planning
        ? "Only checked-in players who are waiting or playing can be planned into a waiting game."
        : "Only checked-in, waiting players can be placed on a court.",
    );

  const clash = planning
    ? undefined
    : state.matches.find((match) => match.courtNumber === courtNumber && isActive(match));
  if (clash) return fail(`${name(courtNumber)} already has a match.`);

  for (const match of state.matches) {
    if (!isActive(match)) continue;
    // Planned (waiting-court) games never block, and do not count against a real court.
    if (planning || match.courtNumber === QUEUED_COURT) continue;
    for (const row of match.players) {
      if (playerIds.includes(row.playerId))
        return fail(`${nicknameOf(state, row.playerId)} is already queued for ${name(match.courtNumber)}.`);
    }
  }

  const inLine = waitingLine(state).length + 1;
  state.matches.push(
    newMatch(matchId, ctx.at, courtNumber, nextRound(state), playerIds.slice(0, 2), playerIds.slice(2)),
  );
  if (planning)
    return ok(`Game set in the waiting court as #${inLine} — transfer it to a court when one is free.`, {
      matchId,
    });
  return ok(`${name(courtNumber)} set by hand.`, { matchId });
}

/**
 * Move a match to another court; with another game there, the two swap. From Next up this is
 * Transfer to Court: the court must be free and none of the four still playing.
 */
export function moveMatchToCourt(
  state: EngineState,
  ctx: OpContext,
  matchId: string,
  courtNumber: number,
): ActionResult {
  if (!Number.isInteger(courtNumber) || courtNumber < 1 || courtNumber > 20)
    return fail("Pick a valid court.");
  const match = findMatch(state, matchId);
  if (!match) return fail("Match not found.");
  const name = courtNamer(state, ctx.at);
  if (match.status === "COMPLETED" || match.status === "CANCELLED")
    return fail("This match can no longer be moved.");
  if (match.courtNumber === courtNumber) return ok("Match is already on that court.");

  const occupant = state.matches.find(
    (other) => other.courtNumber === courtNumber && isActive(other) && other.id !== matchId,
  );
  if (occupant && match.courtNumber === QUEUED_COURT)
    return fail(`${name(courtNumber)} is in use. Finish or cancel that game first.`);

  // A Next up game can include players still finishing on another court.
  if (match.courtNumber === QUEUED_COURT) {
    const stillPlaying = state.matches
      .filter((other) => other.status === "LIVE")
      .flatMap((other) =>
        other.players
          .filter((row) => hasPlayer(match, row.playerId))
          .map((row) => `${nicknameOf(state, row.playerId)} (${name(other.courtNumber)})`),
      );
    if (stillPlaying.length > 0)
      return fail(`Still playing: ${stillPlaying.join(", ")}. Transfer this game once they finish.`);
  }

  const from = match.courtNumber;
  if (occupant) {
    match.courtNumber = courtNumber;
    occupant.courtNumber = from;
    match.updatedAt = ctx.at;
    occupant.updatedAt = ctx.at;
    return ok(`Swapped ${name(from)} and ${name(courtNumber)}.`);
  }
  match.courtNumber = courtNumber;
  match.updatedAt = ctx.at;
  return ok(
    from === QUEUED_COURT
      ? `Next up game transferred to ${name(courtNumber)}. Start it when they're on court.`
      : `Moved to ${name(courtNumber)}.${transferHint(state)}`,
  );
}

/** Swap two players between two active matches, leaving the rest of each line-up as it is. */
export function swapMatchPlayers(
  state: EngineState,
  ctx: OpContext,
  matchIdA: string,
  playerIdA: string,
  matchIdB: string,
  playerIdB: string,
): ActionResult {
  if (matchIdA === matchIdB) return fail("Drop a player onto another match to swap.");
  if (playerIdA === playerIdB) return ok("No change.");
  const a = findMatch(state, matchIdA);
  const b = findMatch(state, matchIdB);
  if (!a || !b) return fail("Match not found.");
  if ([a, b].some((match) => match.status === "COMPLETED" || match.status === "CANCELLED"))
    return fail("Finished matches cannot be changed.");
  const rowA = a.players.find((row) => row.playerId === playerIdA);
  const rowB = b.players.find((row) => row.playerId === playerIdB);
  if (!rowA || !rowB) return fail("Those players are not on those courts.");
  if (hasPlayer(a, playerIdB) || hasPlayer(b, playerIdA))
    return fail("That swap would duplicate a player on one court.");

  rowA.playerId = playerIdB;
  rowB.playerId = playerIdA;
  a.updatedAt = ctx.at;
  b.updatedAt = ctx.at;
  for (const match of [a, b]) {
    updatePlayers(
      state,
      match.players.map((row) => row.playerId),
      { status: match.status === "LIVE" ? "PLAYING" : "WAITING" },
    );
  }
  return ok("Players swapped.");
}

/** Moves a game in the waiting line to a new place (0 is next up). Others keep their order. */
export function reorderQueuedGame(
  state: EngineState,
  ctx: OpContext,
  matchId: string,
  toIndex: number,
): ActionResult {
  if (!Number.isInteger(toIndex)) return fail("Pick a place in the line.");
  const line = waitingLine(state);
  if (!line.some((match) => match.id === matchId)) return fail("That game is no longer in the waiting line.");
  const next = moveInLine(
    line.map((match) => match.id),
    matchId,
    toIndex,
  );
  if (!next) return ok("Already there.");
  const times = lineTimes(line.map((match) => match.createdAt));
  next.forEach((id, index) => {
    const match = findMatch(state, id)!;
    match.createdAt = times[index];
    match.updatedAt = ctx.at;
  });
  return ok(
    next.indexOf(matchId) === 0 ? "Now up next." : `Moved to place ${next.indexOf(matchId) + 1} in line.`,
  );
}

export function clearSuggestedMatches(state: EngineState): ActionResult {
  // Games in the Next up line are cancelled one at a time, not cleared with the court suggestions.
  const before = state.matches.length;
  state.matches = state.matches.filter(
    (match) => !(match.status === "SUGGESTED" && match.courtNumber !== QUEUED_COURT),
  );
  const count = before - state.matches.length;
  return ok(count ? `${count} suggestions cleared.` : "No suggestions to clear.");
}

/** How a finished game counts: toward games and fees, played free, or left off the record. */
export type MatchRecord = "counted" | "free" | "unrecorded";

export function recordOf(match: EngineMatch): MatchRecord {
  if (match.status !== "COMPLETED") return "unrecorded";
  return match.free ? "free" : "counted";
}

const RECORD_DONE: Record<MatchRecord, string> = {
  counted: "counts as a game again",
  free: "is now a free game, not counted",
  unrecorded: "is off the record",
};

function finishedGameEditable(state: EngineState, match: EngineMatch | undefined): ActionResult | null {
  if (!match) return fail("Match not found.");
  if (!isFinishedGame(match)) return fail("Only finished games can be changed here.");
  if (state.gameDay.status === "COMPLETED")
    return fail("This game day is closed. Reopen it in Settings to change its games.");
  return null;
}

/** Adds `delta` games to each of these players, never going below zero. */
function addGames(state: EngineState, playerIds: string[], delta: number) {
  if (delta === 0) return;
  const ids = new Set(playerIds);
  for (const row of state.players)
    if (ids.has(row.playerId)) row.gamesPlayed = Math.max(0, row.gamesPlayed + delta);
}

/**
 * Change how a finished game counts. Counted adds one game (and its fee) for each of the four,
 * free and not recorded don't; moving between them adjusts their game counts. A game that's not
 * recorded also drops out of the match list, the reports and the pairing history.
 */
export function setMatchRecord(
  state: EngineState,
  ctx: OpContext,
  matchId: string,
  record: MatchRecord,
): ActionResult {
  if (!Object.hasOwn(RECORD_DONE, record)) return fail("Choose counted, free or not recorded.");
  const match = findMatch(state, matchId);
  const refused = finishedGameEditable(state, match);
  if (refused) return refused;
  const game = match!;
  const before = recordOf(game);
  const name = courtNamer(state, ctx.at)(game.courtNumber);
  if (before === record) return ok(`The game on ${name} ${RECORD_DONE[record]}.`);

  addGames(
    state,
    game.players.map((row) => row.playerId),
    Number(record === "counted") - Number(before === "counted"),
  );
  Object.assign(game, {
    status: record === "unrecorded" ? "CANCELLED" : "COMPLETED",
    free: record === "free",
    updatedAt: ctx.at,
  });
  return ok(`The game on ${name} ${RECORD_DONE[record]}.`);
}

/**
 * Fix who played a finished game. If it counts, whoever comes off loses that game and whoever
 * goes on gains it. Only players checked in today can be put in.
 */
export function editFinishedMatch(
  state: EngineState,
  ctx: OpContext,
  matchId: string,
  team1: string[],
  team2: string[],
): ActionResult {
  if (team1.length !== 2 || team2.length !== 2) return fail("Each team needs exactly two players.");
  const all = [...team1, ...team2];
  if (new Set(all).size !== 4) return fail("A player cannot appear twice in one match.");
  const match = findMatch(state, matchId);
  const refused = finishedGameEditable(state, match);
  if (refused) return refused;
  const game = match!;

  // Only the players being put in are checked; whoever already played it can stay.
  const before = game.players.map((row) => row.playerId);
  const rows = all.filter((id) => !before.includes(id)).map((id) => playerById(state, id));
  if (rows.some((row) => row === undefined)) return fail("All four players must be on this game day.");
  const notHere = rows.find((row) => row!.status === "EXPECTED");
  if (notHere) return fail(`${notHere.nickname} hasn't checked in today.`);

  if (recordOf(game) === "counted") {
    addGames(
      state,
      before.filter((id) => !all.includes(id)),
      -1,
    );
    addGames(
      state,
      all.filter((id) => !before.includes(id)),
      1,
    );
  }
  game.players = [
    ...team1.map((playerId, index) => ({ playerId, team: 1, slot: index + 1 })),
    ...team2.map((playerId, index) => ({ playerId, team: 2, slot: index + 1 })),
  ];
  game.updatedAt = ctx.at;
  return ok(`Players on the ${courtNamer(state, ctx.at)(game.courtNumber)} game updated.`);
}
