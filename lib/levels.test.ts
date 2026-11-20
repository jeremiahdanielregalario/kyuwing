import { describe, expect, it } from "vitest";
import { LEVELS, LEVEL_OPTIONS, bracketOf, isUnrated, levelLabel, levelValue, parseLevel } from "./levels";

describe("X (not rated yet)", () => {
  it("parses X from a sheet or form", () => {
    expect(parseLevel("X")).toBe("X");
    expect(parseLevel("x")).toBe("X");
  });

  it("is a picker option but not on the 13-level ladder", () => {
    expect(LEVELS).toHaveLength(13);
    expect(LEVELS.some((level) => (level.key as string) === "X")).toBe(false);
    expect(LEVEL_OPTIONS.at(-1)?.key).toBe("X");
  });

  it("labels as X and is detected as unrated", () => {
    expect(levelLabel("X")).toBe("X");
    expect(isUnrated("X")).toBe(true);
    expect(isUnrated("E")).toBe(false);
  });

  it("still parses the ladder labels", () => {
    expect(parseLevel("D+")).toBe("D_PLUS");
    expect(parseLevel("A-")).toBe("A_MINUS");
    expect(parseLevel("E")).toBe("E");
  });
});

describe("the 13-level ladder", () => {
  it("runs E < D- < D < D+ < C- < ... < A+ with values 0 to 12", () => {
    expect(LEVELS.map((level) => level.label)).toEqual([
      "E",
      "D-",
      "D",
      "D+",
      "C-",
      "C",
      "C+",
      "B-",
      "B",
      "B+",
      "A-",
      "A",
      "A+",
    ]);
    expect(LEVELS.map((level) => level.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("offers no retired level in the pickers", () => {
    const labels = LEVEL_OPTIONS.map((level) => level.label as string);
    for (const retired of ["E-", "E+", "DE", "CD", "BC", "AB"]) expect(labels).not.toContain(retired);
  });

  it("folds E- and E+ into E, and rounds border levels down", () => {
    expect(parseLevel("E-")).toBe("E");
    expect(parseLevel("e plus")).toBe("E");
    expect(parseLevel("E_MINUS")).toBe("E");
    expect(parseLevel("DE")).toBe("E");
    expect(parseLevel("cd")).toBe("D_PLUS");
    expect(parseLevel("BC")).toBe("C_PLUS");
    expect(parseLevel("AB")).toBe("B_PLUS");
  });

  it("reads a retired level kept on a tablet as its new level", () => {
    expect(levelLabel("AB")).toBe("B+");
    expect(levelValue("AB")).toBe(levelValue("B_PLUS"));
    expect(bracketOf("CD")).toBe("D");
    expect(levelLabel("E_PLUS")).toBe("E");
  });
});
