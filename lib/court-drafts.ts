/**
 * Hand-filled courts on the queue board: the players dropped into an open court's four places
 * before it becomes a game. Kept per court number (places 0-1 are team A, 2-3 team B). Waiting
 * courts being filled by hand are keyed QUEUED_COURT (0) and below (-1, -2, ...), so several can
 * be part-filled at once; each becomes a waiting game (court 0) when its four are in. Pure, so
 * the moves are unit-tested.
 */
import { QUEUED_COURT } from "@/lib/datetime";

export type CourtDrafts = Record<number, Array<string | null>>;

export const EMPTY_DRAFT: Array<string | null> = [null, null, null, null];

/**
 * Puts a player in a place. They leave any other place they were in (on any court), so nobody
 * is in two places. When they were dragged from another place (`from`) onto an occupied one, the
 * two trade places; otherwise the occupant is simply replaced.
 */
export function placeInDrafts(
  drafts: CourtDrafts,
  court: number,
  index: number,
  playerId: string,
  from?: { courtNumber: number; index: number },
): CourtDrafts {
  const occupant = (drafts[court] ?? EMPTY_DRAFT)[index] ?? null;
  const next = removeFromDrafts(drafts, playerId);
  const target = [...(next[court] ?? EMPTY_DRAFT)];
  target[index] = playerId;
  next[court] = target;
  if (from && occupant && occupant !== playerId) {
    const source = [...(next[from.courtNumber] ?? EMPTY_DRAFT)];
    if (source[from.index] === null) {
      source[from.index] = occupant;
      next[from.courtNumber] = source;
    }
  }
  return next;
}

/** Takes a player out of every hand-filled place. */
export function removeFromDrafts(drafts: CourtDrafts, playerId: string): CourtDrafts {
  const next: CourtDrafts = {};
  for (const [court, places] of Object.entries(drafts)) {
    next[Number(court)] = places.map((id) => (id === playerId ? null : id));
  }
  return next;
}

/** The first court in `courts` with a free place, and that place; null when all are full. */
export function firstFreePlace(
  drafts: CourtDrafts,
  courts: number[],
): { court: number; index: number } | null {
  for (const court of courts) {
    const index = (drafts[court] ?? EMPTY_DRAFT).findIndex((id) => id === null);
    if (index >= 0) return { court, index };
  }
  return null;
}

/** True for a waiting court's key (0, -1, -2, ...); false for a real court (1 and up). */
export function isWaitingDraft(court: number): boolean {
  return court <= QUEUED_COURT;
}

/** The court a hand-filled court's game goes on: its own number, or the waiting line. */
export function draftCourt(court: number): number {
  return isWaitingDraft(court) ? QUEUED_COURT : court;
}

/** Waiting courts with at least one player placed, oldest first (0, -1, -2, ...). */
export function waitingDrafts(drafts: CourtDrafts): number[] {
  return Object.entries(drafts)
    .filter(([court, places]) => isWaitingDraft(Number(court)) && places.some(Boolean))
    .map(([court]) => Number(court))
    .sort((a, b) => b - a);
}

/**
 * The key for the empty waiting court shown after the part-filled ones: below every one in use,
 * so it never lands on (or reorders) a court someone is filling. Back to 0 once all are empty.
 */
export function newWaitingDraft(drafts: CourtDrafts): number {
  const used = waitingDrafts(drafts);
  return used.length ? Math.min(...used) - 1 : QUEUED_COURT;
}
