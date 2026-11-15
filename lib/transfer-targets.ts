import type { BoardData } from "./board-types";

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
