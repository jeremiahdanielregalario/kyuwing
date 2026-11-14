import { QUEUED_COURT } from "@/lib/datetime";
import type { BoardMatch } from "@/lib/board-types";

/** A paired game left unstarted on a court this long brings up the Start reminder. */
export const START_NUDGE_MS = 60 * 1000;

/** "4 min", "1 h 05 min": how long a paired game has waited for Start. */
export function formatWaited(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/**
 * Games on a real court that still need the queue master to press Start, and should pop up a
 * reminder: they were paired or moved onto the court at least `START_NUDGE_MS` ago (a game that
 * just moved up is given the same minute, as it is usually started right away). Games answered "Not yet" (`laterIds`) never pop up
 * again. `now` is 0 before the clock starts on the client, which only skips the time rule.
 */
export function gamesToStart(
  matches: BoardMatch[],
  { now, laterIds }: { now: number; laterIds: ReadonlySet<string> },
): BoardMatch[] {
  return matches.filter(
    (match) =>
      match.status === "SUGGESTED" &&
      match.courtNumber !== QUEUED_COURT &&
      !laterIds.has(match.id) &&
      now > 0 &&
      now - Date.parse(match.changedAt) >= START_NUDGE_MS,
  );
}
