import { GAME_MINUTES } from "@/lib/planning";

/**
 * Late arrivals: a player who checks in after the first court time has missed the games they
 * would have played meanwhile. Auto-pair counts those missed games as if played (see
 * `PairingPlayer.missedGames`), so arriving late is not rewarded with priority for having
 * fewer games, and the later they arrive the more games they lose. Pure, so it is unit-tested.
 */

/** Checking in up to this long after the first court time is not late. */
export const LATE_GRACE_MINUTES = 10;

/** The first court time of a game day as a real instant (Manila is UTC+8, no daylight saving). */
export function gameStartInstant(gameDate: Date | string, firstCourtTime: string): Date {
  const key = (typeof gameDate === "string" ? gameDate : gameDate.toISOString()).slice(0, 10);
  return new Date(`${key}T${firstCourtTime}:00+08:00`);
}

/**
 * Games a late player is treated as having played: the minutes they were late times the pace a
 * checked-in player gets games at (each game takes about `GAME_MINUTES`, and with more players
 * than places on court, each player plays only a share of the games). One decimal place.
 */
export function missedGames(input: {
  joinedAt: Date | null;
  gameStart: Date;
  /** Courts in play. */
  courts: number;
  /** Players checked in. */
  players: number;
}): number {
  if (!input.joinedAt || input.courts < 1) return 0;
  const lateMinutes = (input.joinedAt.getTime() - input.gameStart.getTime()) / 60000;
  if (lateMinutes <= LATE_GRACE_MINUTES) return 0;
  const share = Math.min(1, (4 * input.courts) / Math.max(1, input.players));
  return Math.round(((lateMinutes * share) / GAME_MINUTES) * 10) / 10;
}
