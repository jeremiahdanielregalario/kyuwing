import { describe, expect, it } from "vitest";
import { mismatchWarning } from "./mismatch";

const team = (...levels: string[]) => levels.map((level) => ({ level }));

describe("mismatchWarning", () => {
  it("flags an obvious mismatch like B, C vs D, E", () => {
    const warning = mismatchWarning(team("B", "C"), team("D", "E"));
    expect(warning?.short).toBe("Mismatch: Team A is much stronger");
    expect(warning?.detail).toContain("B, C vs D, E");
    expect(mismatchWarning(team("D", "E"), team("B", "C"))?.short).toContain("Team B");
  });

  it("stays quiet for close games", () => {
    expect(mismatchWarning(team("B", "C"), team("B-", "C+"))).toBeNull();
    expect(mismatchWarning(team("C", "C"), team("C-", "C-"))).toBeNull();
    expect(mismatchWarning(team("B", "D"), team("C", "C"))).toBeNull();
  });

  it("flags even teams whose levels are far apart", () => {
    expect(mismatchWarning(team("B", "E"), team("C", "D"))?.short).toBe("Mismatch: wide level spread");
    expect(mismatchWarning(team("A", "D"), team("B", "C"))?.short).toBe("Mismatch: wide level spread");
  });

  it("leaves unrated players out", () => {
    expect(mismatchWarning(team("X", "X"), team("A", "A"))).toBeNull();
    expect(mismatchWarning(team("C", "X"), team("C", "C"))).toBeNull();
  });
});
