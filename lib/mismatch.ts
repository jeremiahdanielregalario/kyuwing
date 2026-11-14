import { bracketIndex, isUnrated, levelLabel, levelValue } from "@/lib/levels";

/**
 * Warns when a game looks like a mismatch, e.g. a hand-built "B, C vs D, E". Two cases:
 * one team is clearly stronger (their levels add up to `UNEVEN_GAP` or more steps apart), or
 * the four players span brackets `SPREAD_BRACKETS` or more apart (B with E), so even level
 * teams leave someone out of their depth. Unrated (X) players are left out. Pure, so it is
 * unit-tested; the board shows the result as a warning tag on the court.
 */
export const UNEVEN_GAP = 5;
export const SPREAD_BRACKETS = 3;

export type Mismatch = { short: string; detail: string };

export function mismatchWarning(
  team1: Array<{ level: string }>,
  team2: Array<{ level: string }>,
): Mismatch | null {
  const rated = (team: Array<{ level: string }>) => team.filter((player) => !isUnrated(player.level));
  const a = rated(team1);
  const b = rated(team2);
  if (a.length === 0 || b.length === 0) return null;
  const sum = (team: Array<{ level: string }>) =>
    team.reduce((total, player) => total + levelValue(player.level), 0);
  // Compare per-player averages when a team has an unrated player left out.
  const strengthA = (sum(a) / a.length) * 2;
  const strengthB = (sum(b) / b.length) * 2;
  const levels = (team: Array<{ level: string }>) =>
    team.map((player) => levelLabel(player.level)).join(", ");
  const versus = `${levels(a)} vs ${levels(b)}`;

  const gap = Math.abs(strengthA - strengthB);
  if (gap >= UNEVEN_GAP) {
    return {
      short: `Mismatch: Team ${strengthA > strengthB ? "A" : "B"} is much stronger`,
      detail: `${versus}. One team is much stronger, so the game may be one-sided. Swap players to even it out.`,
    };
  }
  const brackets = [...a, ...b].map((player) => bracketIndex(player.level));
  if (Math.max(...brackets) - Math.min(...brackets) >= SPREAD_BRACKETS) {
    return {
      short: "Mismatch: wide level spread",
      detail: `${versus}. The teams are even, but the levels are far apart, so the weakest player may struggle.`,
    };
  }
  return null;
}
