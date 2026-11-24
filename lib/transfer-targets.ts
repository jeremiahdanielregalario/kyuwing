import type { BoardData } from "./board-types";

/**
 * Which Next up games can be transferred to a court right now, and to which one. While any
 * court of the block in play is free, every waiting game whose four players are all off court
 * can go: the free courts go, in order, to those games oldest first, and the games after that
 * point at the first free court (the queue master may skip the line). A game with someone
 * still playing keeps waiting and is skipped.
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
    if (free.length === 0) break;
    if (match.courtNumber !== queuedCourt || match.status !== "SUGGESTED") continue;
    if ([...match.team1, ...match.team2].some((player) => playing.has(player.playerId))) continue;
    targets.set(match.id, free[targets.size] ?? free[0]);
  }
  return targets;
}
