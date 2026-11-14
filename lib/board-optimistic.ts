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
