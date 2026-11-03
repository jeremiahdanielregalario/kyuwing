import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * View-only live board links.
 *
 * The key is an HMAC of the game day id with AUTH_SECRET, so a link cannot be
 * guessed or edited to point at another game day, and nothing is stored.
 * Rotating AUTH_SECRET invalidates every shared link (and every session).
 */

function secret() {
  return process.env.AUTH_SECRET || "kyuwing-dev-secret-change-before-deploying";
}

export function liveViewKey(gameDayId: string): string {
  return createHmac("sha256", secret()).update(`live-view:${gameDayId}`).digest("base64url").slice(0, 22);
}

export function verifyLiveViewKey(gameDayId: string, key: string): boolean {
  const expected = Buffer.from(liveViewKey(gameDayId));
  const given = Buffer.from(key);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function liveViewPath(gameDayId: string): string {
  return `/live/${gameDayId}/${liveViewKey(gameDayId)}`;
}
