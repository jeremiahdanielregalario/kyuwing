import { describe, expect, it } from "vitest";
import { applyCourtSetup, courtNamesText, courtSetupProblem, resizedCourtNames } from "./court-setup";
import type { CourtSlot } from "./datetime";

const slot = (overrides: Partial<CourtSlot> = {}): CourtSlot => ({
  id: "a",
  label: "Block 1",
  start: "18:00",
  end: "20:00",
  courts: 3,
  ...overrides,
});

describe("courtNamesText", () => {
  it("lists positions for unnamed courts", () => {
    expect(courtNamesText(slot())).toBe("1, 2, 3");
  });

  it("uses saved names and fills blanks with the position", () => {
    expect(courtNamesText(slot({ courts: 3, courtLabels: ["5", "", "Main"] }))).toBe("5, 2, Main");
  });
});

describe("resizedCourtNames", () => {
  it("grows and shrinks a run of numbers", () => {
    expect(resizedCourtNames("5, 6, 7", 4)).toBe("5, 6, 7, 8");
    expect(resizedCourtNames("5-8", 2)).toBe("5, 6");
  });

  it("starts at 1 when nothing is typed", () => {
    expect(resizedCourtNames("", 3)).toBe("1, 2, 3");
  });

  it("cuts other names when there are fewer courts, and leaves extra names to the master", () => {
    expect(resizedCourtNames("Main, Side, Back", 2)).toBe("Main, Side");
    expect(resizedCourtNames("Main, Side", 3)).toBeNull();
    expect(resizedCourtNames("2, 5", 3)).toBeNull();
  });
});

describe("courtSetupProblem", () => {
  it("accepts one name per court", () => {
    expect(courtSetupProblem(3, "1, 2, 3")).toBeNull();
    expect(courtSetupProblem(4, "5-8")).toBeNull();
  });

  it("flags a count that doesn't match the names", () => {
    expect(courtSetupProblem(4, "1, 2, 3")).toBe("3 names for 4 courts. Give each court one name.");
    expect(courtSetupProblem(2, "1, 1")).toBe("1 name for 2 courts. Give each court one name.");
  });

  it("needs names and a sensible count", () => {
    expect(courtSetupProblem(2, "  ")).toMatch(/Type the court names/);
    expect(courtSetupProblem(0, "")).toMatch(/between 1 and 20/);
    expect(courtSetupProblem(21, "1-21")).toMatch(/between 1 and 20/);
  });
});

describe("applyCourtSetup", () => {
  const plan = [slot(), slot({ id: "b", label: "Block 2", start: "20:00", end: "22:00", courts: 2 })];

  it("saves the counts and normalized names per block", () => {
    const result = applyCourtSetup(plan, [
      { id: "a", courts: 4, names: "Court 5, c6, 7, 8" },
      { id: "b", courts: 2, names: "5-6" },
    ]);
    expect(result).toEqual({
      plan: [
        { ...plan[0], courts: 4, courtLabels: ["5", "6", "7", "8"] },
        { ...plan[1], courts: 2, courtLabels: ["5", "6"] },
      ],
    });
  });

  it("keeps blocks that weren't in the setup", () => {
    const result = applyCourtSetup(plan, [{ id: "b", courts: 1, names: "Main" }]);
    expect("plan" in result && result.plan[0]).toEqual(plan[0]);
  });

  it("names the block that has a problem", () => {
    expect(applyCourtSetup(plan, [{ id: "b", courts: 3, names: "1, 2" }])).toEqual({
      error: "Block 2: 2 names for 3 courts. Give each court one name.",
    });
  });
});
