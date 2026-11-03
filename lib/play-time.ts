/**
 * Playing time per player, worked out from finished games: start to finish of
 * every game they were in (free games count, they are played too).
 *
 * Shown on the in-app Reports page only. It is deliberately not part of the
 * PDF or Excel downloads, so nothing in the export routes should import this.
 */

export type TimedMatch = {
  startedAt: string | null;
  endedAt: string | null;
  team1: Array<{ playerId: string }>;
  team2: Array<{ playerId: string }>;
};

export type PlayTime = { seconds: number; games: number };

/** Total seconds on court and number of timed games, by player id. */
export function playTimeByPlayer(matches: TimedMatch[]): Map<string, PlayTime> {
  const totals = new Map<string, PlayTime>();
  for (const match of matches) {
    if (!match.startedAt || !match.endedAt) continue;
    const seconds = Math.round((Date.parse(match.endedAt) - Date.parse(match.startedAt)) / 1000);
    if (!Number.isFinite(seconds) || seconds <= 0) continue;
    for (const { playerId } of [...match.team1, ...match.team2]) {
      const current = totals.get(playerId) ?? { seconds: 0, games: 0 };
      current.seconds += seconds;
      current.games += 1;
      totals.set(playerId, current);
    }
  }
  return totals;
}

/** "1h 05m", "42m", "<1m" or "0m". */
export function formatPlayTime(seconds: number): string {
  if (seconds <= 0) return "0m";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "<1m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${String(rest).padStart(2, "0")}m` : `${minutes}m`;
}
