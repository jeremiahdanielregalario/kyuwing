import type { BoardData } from "./board-types";

/**
 * Whether two board snapshots show the same thing. Every poll carries a fresh `serverNow`, so
 * comparing whole snapshots would call each one "new" and redraw the board every few seconds
 * for nothing; this ignores that stamp.
 */
export function sameBoard<T extends Pick<BoardData, "serverNow">>(
  a: T | undefined,
  b: T | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify({ ...a, serverNow: "" }) === JSON.stringify({ ...b, serverNow: "" });
}
