import type { BoardData, BoardMatch, BoardPlayer } from "./board-types";

/**
 * Instant board updates, applied the moment the queue master presses a button and replaced by
 * the server's answer a moment later (or rolled back if the server refuses). Pure and DB-free.
 */

function withPlayers(
  data: BoardData,
  ids: Set<string>,
  patch: (player: BoardPlayer) => BoardPlayer,
): BoardData {
  return {
    ...data,
    players: data.players.map((player) => (ids.has(player.sessionPlayerId) ? patch(player) : player)),
  };
}

function matchPlayers(match: BoardMatch): Set<string> {
  return new Set([...match.team1, ...match.team2].map((player) => player.sessionPlayerId));
}

export function optimisticStatus(
  data: BoardData,
  sessionPlayerId: string,
  status: BoardPlayer["status"],
  nowIso: string,
): BoardData {
  return withPlayers(data, new Set([sessionPlayerId]), (player) => ({
    ...player,
    status,
    joinedAt: status === "WAITING" ? (player.joinedAt ?? nowIso) : player.joinedAt,
    queuedAt: status === "WAITING" ? nowIso : player.queuedAt,
  }));
}

export function optimisticStart(data: BoardData, matchId: string, free: boolean, nowIso: string): BoardData {
  const match = data.activeMatches.find((row) => row.id === matchId);
  if (!match) return data;
  const next = withPlayers(data, matchPlayers(match), (player) => ({ ...player, status: "PLAYING" }));
  return {
    ...next,
    activeMatches: data.activeMatches.map((row) =>
      row.id === matchId ? { ...row, status: "LIVE", free, startedAt: nowIso, changedAt: nowIso } : row,
    ),
  };
}

/** Ends a live game: off the court, the four back in the queue, and a game counted unless it was free. */
export function optimisticFinish(data: BoardData, matchId: string, nowIso: string): BoardData {
  const match = data.activeMatches.find((row) => row.id === matchId);
  if (!match) return data;
  const next = withPlayers(data, matchPlayers(match), (player) => ({
    ...player,
    status: "WAITING",
    queuedAt: nowIso,
    gamesPlayed: player.gamesPlayed + (match.free ? 0 : 1),
  }));
  return {
    ...next,
    activeMatches: data.activeMatches.filter((row) => row.id !== matchId),
    recentMatches: [{ ...match, status: "COMPLETED", endedAt: nowIso }, ...data.recentMatches],
  };
}

/** Cancels a game: it leaves the board and anyone who was on court goes back to waiting. */
export function optimisticCancel(data: BoardData, matchId: string): BoardData {
  const match = data.activeMatches.find((row) => row.id === matchId);
  if (!match) return data;
  const next = withPlayers(data, matchPlayers(match), (player) =>
    player.status === "PLAYING" ? { ...player, status: "WAITING" } : player,
  );
  return { ...next, activeMatches: data.activeMatches.filter((row) => row.id !== matchId) };
}

/**
 * Which Next up games can be transferred to a court right now, and to which one: the free
 * courts of the block in play go, in order, to the waiting games whose four players are all
 * off court, oldest first. A game with someone still playing keeps waiting and is skipped.
 */
export function transferTargets(data: BoardData, courts: number[], queuedCourt: number): Map<string, number> {
  const taken = new Set(data.activeMatches.map((match) => match.courtNumber));
  const free = courts.filter((court) => court !== queuedCourt && !taken.has(court));
  const playing = new Set(
    data.activeMatches
      .filter((match) => match.status === "LIVE")
      .flatMap((match) => [...match.team1, ...match.team2].map((player) => player.playerId)),
  );
  const targets = new Map<string, number>();
  for (const match of data.activeMatches) {
    if (targets.size === free.length) break;
    if (match.courtNumber !== queuedCourt || match.status !== "SUGGESTED") continue;
    if ([...match.team1, ...match.team2].some((player) => playing.has(player.playerId))) continue;
    targets.set(match.id, free[targets.size]);
  }
  return targets;
}

/** Transfer to Court: the waiting game takes the court, still waiting to be started. */
export function optimisticTransfer(data: BoardData, matchId: string, court: number): BoardData {
  return {
    ...data,
    activeMatches: data.activeMatches.map((row) =>
      row.id === matchId ? { ...row, courtNumber: court } : row,
    ),
  };
}
