/**
 * Planning ahead for the waiting courts.
 *
 * A game takes about `GAME_MINUTES`, so every court has an estimated time it
 * frees up, and every game in the waiting line an estimated start (the next
 * court to free up, in order). A player is fine to put in a waiting game, even
 * while still playing or sitting in an earlier waiting game, when they are
 * expected to be done by then. The one hard rule, enforced when a game starts,
 * is that nobody is on two playing courts at the same time.
 *
 * Pure (times are epoch milliseconds), so it can be unit-tested.
 */

/** Typical length of one game, used only for estimates. */
export const GAME_MINUTES = 15;
const GAME_MS = GAME_MINUTES * 60_000;

export type BusyCourt = {
  courtNumber: number;
  /** Epoch ms the game on it started, or null when it is assigned but not started yet. */
  startedAt: number | null;
};

/** When a court is expected to be free: its game's start plus a game, never earlier than now. */
export function courtFreeAt(court: BusyCourt, now: number): number {
  return court.startedAt === null ? now + GAME_MS : Math.max(now, court.startedAt + GAME_MS);
}

export type Timeline = {
  /** Estimated start of each game already in the waiting line, in order. */
  starts: number[];
  /** Estimated start of the next game added to the line. */
  nextStart: number;
};

/**
 * Walks the waiting line: each game takes the court that frees up first, and
 * holds it for a game's length. Courts beyond `totalCourts` do not exist.
 */
export function planTimeline(input: {
  now: number;
  totalCourts: number;
  busy: BusyCourt[];
  queuedGames: number;
}): Timeline {
  const free = Array.from({ length: Math.max(0, input.totalCourts) }, (_, index) => {
    const court = input.busy.find((row) => row.courtNumber === index + 1);
    return court ? courtFreeAt(court, input.now) : input.now;
  });
  // No courts to plan around: assume one game's wait per game ahead.
  if (free.length === 0) free.push(input.now + GAME_MS);

  const starts: number[] = [];
  for (let game = 0; game < input.queuedGames; game += 1) {
    const index = free.indexOf(Math.min(...free));
    starts.push(free[index]);
    free[index] += GAME_MS;
  }
  return { starts, nextStart: Math.min(...free) };
}

/** Can this player be in a game that starts at `start`, given when they are next free? */
export function isFreeBy(availableAt: number, start: number): boolean {
  return availableAt <= start;
}

/**
 * When a player is next expected to be free, from the game they are in.
 * `now` for someone not in a game; the end of their live game; or the end of
 * the latest waiting game they are planned for.
 */
export function playerAvailableAt(input: {
  now: number;
  liveStartedAt: number | null;
  /** Estimated starts of the waiting games this player is in. */
  plannedStarts: number[];
}): number {
  let at = input.now;
  if (input.liveStartedAt !== null) at = Math.max(at, input.liveStartedAt + GAME_MS);
  for (const start of input.plannedStarts) at = Math.max(at, start + GAME_MS);
  return at;
}
