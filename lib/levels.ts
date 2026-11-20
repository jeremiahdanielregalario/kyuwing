import { SkillLevel } from "@prisma/client";

/**
 * The UP BadAss ladder, lowest to highest.
 * Numeric values are used by the pairing engine; labels are what queue masters see.
 * The five "brackets" (E, D, C, B, A) are used for the "same bracket ±1" rule.
 * E is a single flat level; D, C, B and A each have a minus, plain and plus step.
 */
export const LEVELS = [
  { key: SkillLevel.E, label: "E", value: 0, bracket: "E" },
  { key: SkillLevel.D_MINUS, label: "D-", value: 1, bracket: "D" },
  { key: SkillLevel.D, label: "D", value: 2, bracket: "D" },
  { key: SkillLevel.D_PLUS, label: "D+", value: 3, bracket: "D" },
  { key: SkillLevel.C_MINUS, label: "C-", value: 4, bracket: "C" },
  { key: SkillLevel.C, label: "C", value: 5, bracket: "C" },
  { key: SkillLevel.C_PLUS, label: "C+", value: 6, bracket: "C" },
  { key: SkillLevel.B_MINUS, label: "B-", value: 7, bracket: "B" },
  { key: SkillLevel.B, label: "B", value: 8, bracket: "B" },
  { key: SkillLevel.B_PLUS, label: "B+", value: 9, bracket: "B" },
  { key: SkillLevel.A_MINUS, label: "A-", value: 10, bracket: "A" },
  { key: SkillLevel.A, label: "A", value: 11, bracket: "A" },
  { key: SkillLevel.A_PLUS, label: "A+", value: 12, bracket: "A" },
] as const;

/**
 * Levels retired in the 13-level ladder, and where each now sits: E-/E+ fold into E, and each
 * border level (DE, CD, BC, AB) rounds down to the top of the bracket below. A game day saved
 * on a tablet before the change, or an old spreadsheet, can still carry these, so they are
 * read through this map instead of being dropped.
 */
export const RETIRED_LEVELS: Record<string, SkillLevel> = {
  E_MINUS: SkillLevel.E,
  E_PLUS: SkillLevel.E,
  DE: SkillLevel.E,
  CD: SkillLevel.D_PLUS,
  BC: SkillLevel.C_PLUS,
  AB: SkillLevel.B_PLUS,
  "E-": SkillLevel.E,
  "E+": SkillLevel.E,
};

/**
 * "X": the player's official level is not known yet (typically a new applicant).
 * It is not on the ladder: the pairing engine never places an X player by itself,
 * and the queue board asks for a real level before such a player's game can start.
 */
export const UNRATED_LEVEL = { key: SkillLevel.X, label: "X", value: 0, bracket: "E" } as const;

/** Every level a player record can hold, for pickers: the ladder, then X. */
export const LEVEL_OPTIONS = [...LEVELS, UNRATED_LEVEL] as const;

export function isUnrated(level: SkillLevel | string): boolean {
  return level === SkillLevel.X || level === "X";
}

export type LevelKey = (typeof LEVEL_OPTIONS)[number]["key"];
export type Bracket = (typeof LEVELS)[number]["bracket"];

export const LEVEL_LABELS = Object.fromEntries(
  LEVEL_OPTIONS.map((level) => [level.key, level.label]),
) as Record<SkillLevel, string>;

export const LEVEL_BY_LABEL = new Map(LEVEL_OPTIONS.map((level) => [level.label.toLowerCase(), level]));

export const BRACKET_ORDER: Bracket[] = ["E", "D", "C", "B", "A"];

export const BRACKET_LABELS: Record<Bracket, string> = {
  E: "Beginner",
  D: "Developing",
  C: "Intermediate",
  B: "Advanced",
  A: "Open",
};

export function levelInfo(level: SkillLevel | string) {
  if (isUnrated(level)) return UNRATED_LEVEL;
  const key = RETIRED_LEVELS[level] ?? level;
  return LEVELS.find((row) => row.key === key || row.label === key) ?? LEVELS[0];
}

export function levelLabel(level: SkillLevel | string): string {
  return levelInfo(level).label;
}

export function levelValue(level: SkillLevel | string): number {
  return levelInfo(level).value;
}

export function bracketOf(level: SkillLevel | string): Bracket {
  return levelInfo(level).bracket;
}

export function bracketIndex(level: SkillLevel | string): number {
  return BRACKET_ORDER.indexOf(bracketOf(level));
}

export function bracketGap(a: SkillLevel | string, b: SkillLevel | string): number {
  return Math.abs(bracketIndex(a) - bracketIndex(b));
}

/** Accepts "A+", "a plus", "A_PLUS", "A-", etc. Returns null when unrecognised. */
export function parseLevel(input: string): LevelKey | null {
  const value = input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .replace("PLUS", "+")
    .replace("MINUS", "-");
  if (value === "X") return SkillLevel.X;
  // "E-", "e minus", "E_MINUS" and the border levels all arrive here as "E-", "DE", ...
  const retired = RETIRED_LEVELS[value];
  if (retired) return retired;
  const found = LEVELS.find(
    (level) => level.label.toUpperCase() === value || level.key.replace("_", "") === value,
  );
  return found?.key ?? null;
}

/** Level colour tokens shared by badges and charts. */
export function levelTone(level: SkillLevel | string) {
  if (isUnrated(level)) {
    return { bg: "bg-white", text: "text-muted", ring: "ring-line-strong", solid: "bg-stone-300" };
  }
  const bracket = bracketOf(level);
  switch (bracket) {
    case "A":
      return { bg: "bg-rose-100", text: "text-rose-800", ring: "ring-rose-200", solid: "bg-rose-500" };
    case "B":
      return { bg: "bg-amber-100", text: "text-amber-900", ring: "ring-amber-200", solid: "bg-amber-500" };
    case "C":
      return { bg: "bg-lime-100", text: "text-lime-900", ring: "ring-lime-200", solid: "bg-lime-500" };
    case "D":
      return { bg: "bg-sky-100", text: "text-sky-900", ring: "ring-sky-200", solid: "bg-sky-500" };
    default:
      return { bg: "bg-stone-100", text: "text-stone-700", ring: "ring-stone-200", solid: "bg-stone-400" };
  }
}
