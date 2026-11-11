import { describe, expect, it } from "vitest";
import { LEVELS, LEVEL_OPTIONS, isUnrated, levelLabel, parseLevel } from "./levels";

describe("X (not rated yet)", () => {
  it("parses X from a sheet or form", () => {
    expect(parseLevel("X")).toBe("X");
    expect(parseLevel("x")).toBe("X");
  });

  it("is a picker option but not on the 19-level ladder", () => {
    expect(LEVELS).toHaveLength(19);
    expect(LEVELS.some((level) => (level.key as string) === "X")).toBe(false);
    expect(LEVEL_OPTIONS.at(-1)?.key).toBe("X");
  });

  it("labels as X and is detected as unrated", () => {
    expect(levelLabel("X")).toBe("X");
    expect(isUnrated("X")).toBe(true);
    expect(isUnrated("E_MINUS")).toBe(false);
  });

  it("still parses the ladder labels", () => {
    expect(parseLevel("D+")).toBe("D_PLUS");
    expect(parseLevel("A-")).toBe("A_MINUS");
    expect(parseLevel("E")).toBe("E");
  });
});
