import { BRACKET_LABELS, BRACKET_ORDER, bracketOf, type Bracket } from "@/lib/levels";

/**
 * Where a player stands on the board, for the queue list: free (checked in, in no game yet),
 * queued (in a paired game waiting for a court or to start), on court, expected or done.
 */
export type QueueState = "waiting" | "queued" | "playing" | "expected" | "done";

const WAITING_LIST_RANK: Partial<Record<QueueState, number>> = { waiting: 0, queued: 1, playing: 2 };

/**
 * The Waiting tab: everyone checked in, so the queue master sees the whole line in one place.
 * Free players come first (they are the ones to pair), then those in a paired game, then those
 * on court; the board highlights the last two. Within each group the given (line) order is kept.
 */
export function waitingList<T>(players: T[], stateOf: (player: T) => QueueState): T[] {
  return players
    .map((player, index) => ({ player, index, rank: WAITING_LIST_RANK[stateOf(player)] }))
    .filter((row): row is typeof row & { rank: number } => row.rank !== undefined)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((row) => row.player);
}

export type BracketGroup<T> = { bracket: Bracket; label: string; players: T[] };

/**
 * The queue grouped by bracket, strongest first (A, B, C, D, E), each keeping the given order.
 * Empty brackets are left out. Unrated players count as E, as everywhere else.
 */
export function byBracket<T extends { level: string }>(players: T[]): BracketGroup<T>[] {
  return [...BRACKET_ORDER]
    .reverse()
    .map((bracket) => ({
      bracket,
      label: BRACKET_LABELS[bracket],
      players: players.filter((player) => bracketOf(player.level) === bracket),
    }))
    .filter((group) => group.players.length > 0);
}
