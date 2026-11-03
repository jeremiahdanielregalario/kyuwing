/**
 * Player recency scoring.
 *
 * Attendance lists (game days and tournaments) are imported as events. Each
 * event contributes a decaying weight: a game played today counts fully, a
 * game six months ago counts almost nothing. Waitlisting counts for less than
 * playing but still shows the player wants in, because the goal is to separate
 * people who still show up from people who have drifted away.
 *
 * This module is pure and DB-free so it can be unit-tested directly.
 */

export type RecencyStatus = "PLAYED" | "WAITLIST";

export type RecencyEntry = {
  date: Date;
  status: RecencyStatus;
};

export type RecencyBand = "hot" | "warm" | "cooling" | "dormant" | "new";

export type RecencySummary = {
  score: number;
  band: RecencyBand;
  bandLabel: string;
  lastPlayed: Date | null;
  lastWaitlist: Date | null;
  daysSincePlayed: number | null;
  /** Days since the player last played or joined a waitlist. */
  daysSinceActive: number | null;
  played90: number;
  waitlist90: number;
  totalPlayed: number;
  totalEvents: number;
};

/** Client-safe version of the summary (dates as ISO strings). */
export type RecencySnapshot = {
  score: number;
  band: RecencyBand;
  bandLabel: string;
  lastPlayed: string | null;
  daysSincePlayed: number | null;
  daysSinceActive: number | null;
  played90: number;
  waitlist90: number;
};

export function toRecencySnapshot(summary: RecencySummary): RecencySnapshot {
  return {
    score: summary.score,
    band: summary.band,
    bandLabel: summary.bandLabel,
    lastPlayed: summary.lastPlayed?.toISOString() ?? null,
    daysSincePlayed: summary.daysSincePlayed,
    daysSinceActive: summary.daysSinceActive,
    played90: summary.played90,
    waitlist90: summary.waitlist90,
  };
}

/** Days after which an event's weight halves. */
export const RECENCY_HALF_LIFE_DAYS = 60;
/** Events older than this no longer contribute to the score. */
export const RECENCY_WINDOW_DAYS = 365;
/** Recent-window used for the "sessions in 90 days" counters. */
export const RECENCY_COUNT_DAYS = 90;
/** Active within this many days counts as still playing. */
export const RECENCY_ACTIVE_DAYS = 30;
/** Score needed (while still active) to count as playing often. */
export const RECENCY_HOT_SCORE = 55;

const PLAY_WEIGHT = 1;
const WAITLIST_WEIGHT = 0.4;
/** Larger values flatten the score curve; 2 keeps scores spread across the range. */
const SCORE_SCALE = 2;

const DAY_MS = 86_400_000;

export const RECENCY_BAND_LABELS: Record<RecencyBand, string> = {
  hot: "Playing often",
  warm: "Playing",
  cooling: "Cooling off",
  dormant: "Dormant",
  new: "No history",
};

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / DAY_MS;
}

/**
 * Bands follow the last time someone showed up (played or waitlisted), so a
 * single game last week reads as "Playing", not "Cooling off". The score,
 * which also rewards frequency, decides who is playing often.
 */
export function recencyBand(score: number, daysSinceActive: number | null): RecencyBand {
  if (daysSinceActive === null) return "new";
  if (daysSinceActive <= RECENCY_ACTIVE_DAYS) return score >= RECENCY_HOT_SCORE ? "hot" : "warm";
  if (daysSinceActive <= RECENCY_COUNT_DAYS) return "cooling";
  return "dormant";
}

/**
 * Score a single player from their attendance history.
 *
 * `now` is injectable so tests do not depend on the wall clock.
 */
export function recencySummary(entries: RecencyEntry[], now: Date = new Date()): RecencySummary {
  let weighted = 0;
  let played90 = 0;
  let waitlist90 = 0;
  let totalPlayed = 0;
  let lastPlayed: Date | null = null;
  let lastWaitlist: Date | null = null;

  for (const entry of entries) {
    const ageDays = Math.max(0, daysBetween(entry.date, now));

    if (ageDays <= RECENCY_WINDOW_DAYS) {
      const weight = entry.status === "PLAYED" ? PLAY_WEIGHT : WAITLIST_WEIGHT;
      weighted += weight * Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
    }

    if (ageDays <= RECENCY_COUNT_DAYS) {
      if (entry.status === "PLAYED") played90 += 1;
      else waitlist90 += 1;
    }

    if (entry.status === "PLAYED") {
      totalPlayed += 1;
      if (!lastPlayed || entry.date > lastPlayed) lastPlayed = entry.date;
    } else if (!lastWaitlist || entry.date > lastWaitlist) {
      lastWaitlist = entry.date;
    }
  }

  const daysSince = (date: Date | null) => (date ? Math.max(0, Math.round(daysBetween(date, now))) : null);
  const lastActive =
    lastPlayed && lastWaitlist
      ? lastPlayed > lastWaitlist
        ? lastPlayed
        : lastWaitlist
      : (lastPlayed ?? lastWaitlist);

  const score = entries.length > 0 ? Math.round((100 * weighted) / (weighted + SCORE_SCALE)) : 0;
  const daysSinceActive = daysSince(lastActive);
  const band = recencyBand(score, daysSinceActive);

  return {
    score,
    band,
    bandLabel: RECENCY_BAND_LABELS[band],
    lastPlayed,
    lastWaitlist,
    daysSincePlayed: daysSince(lastPlayed),
    daysSinceActive,
    played90,
    waitlist90,
    totalPlayed,
    totalEvents: entries.length,
  };
}
