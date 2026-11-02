import { SkillLevel } from "@prisma/client";

/**
 * The UP BadAss ladder, lowest to highest.
 * Numeric values are used by the pairing engine; labels are what queue masters see.
 * The five "brackets" (E, D, C, B, A) are used for the "same bracket ±1" rule.
 */
export const LEVELS = [
  { key: SkillLevel.E_MINUS, label: "E-", value: 0, bracket: "E" },
  { key: SkillLevel.E, label: "E", value: 1, bracket: "E" },
  { key: SkillLevel.E_PLUS, label: "E+", value: 2, bracket: "E" },
  { key: SkillLevel.DE, label: "DE", value: 3, bracket: "D" },
  { key: SkillLevel.D_MINUS, label: "D-", value: 4, bracket: "D" },
  { key: SkillLevel.D, label: "D", value: 5, bracket: "D" },
  { key: SkillLevel.D_PLUS, label: "D+", value: 6, bracket: "D" },
  { key: SkillLevel.CD, label: "CD", value: 7, bracket: "C" },
  { key: SkillLevel.C_MINUS, label: "C-", value: 8, bracket: "C" },
  { key: SkillLevel.C, label: "C", value: 9, bracket: "C" },
  { key: SkillLevel.C_PLUS, label: "C+", value: 10, bracket: "C" },
  { key: SkillLevel.BC, label: "BC", value: 11, bracket: "B" },
  { key: SkillLevel.B_MINUS, label: "B-", value: 12, bracket: "B" },
  { key: SkillLevel.B, label: "B", value: 13, bracket: "B" },
  { key: SkillLevel.B_PLUS, label: "B+", value: 14, bracket: "B" },
  { key: SkillLevel.AB, label: "AB", value: 15, bracket: "A" },
  { key: SkillLevel.A_MINUS, label: "A-", value: 16, bracket: "A" },
  { key: SkillLevel.A, label: "A", value: 17, bracket: "A" },
  { key: SkillLevel.A_PLUS, label: "A+", value: 18, bracket: "A" },
] as const;

export type LevelKey = (typeof LEVELS)[number]["key"];
export type Bracket = (typeof LEVELS)[number]["bracket"];

export const LEVEL_LABELS = Object.fromEntries(LEVELS.map((level) => [level.key, level.label])) as Record<
  SkillLevel,
  string
>;

export const LEVEL_BY_LABEL = new Map(LEVELS.map((level) => [level.label.toLowerCase(), level]));

export const BRACKET_ORDER: Bracket[] = ["E", "D", "C", "B", "A"];

export const BRACKET_LABELS: Record<Bracket, string> = {
  E: "Beginner",
  D: "Developing",
  C: "Intermediate",
  B: "Advanced",
  A: "Open",
};

export function levelInfo(level: SkillLevel | string) {
  return LEVELS.find((row) => row.key === level || row.label === level) ?? LEVELS[0];
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
  if (value === "DE") return SkillLevel.DE;
  if (value === "CD") return SkillLevel.CD;
  if (value === "BC") return SkillLevel.BC;
  if (value === "AB") return SkillLevel.AB;
  const found = LEVELS.find(
    (level) => level.label.toUpperCase() === value || level.key.replace("_", "") === value,
  );
  return found?.key ?? null;
}

/** Level colour tokens shared by badges and charts. */
export function levelTone(level: SkillLevel | string) {
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
