import { describe, expect, it } from "vitest";
import {
  fitPlan,
  MEGA_EXTRA_MINUTES,
  shiftPlanEnd,
  formatSpan,
  formatTime12,
  planProblem,
  planWindow,
  removeBlock,
  setBlockEnd,
  splitBlock,
  timeChoices,
  type PlanBlock,
} from "./court-plan";

const block = (id: string, start: string, end: string, courts = 3): PlanBlock => ({
  id,
  label: id,
  start,
  end,
  courts,
});
const times = (blocks: PlanBlock[]) => blocks.map((b) => `${b.start}-${b.end}`);
const make = (from: PlanBlock, index: number): PlanBlock => ({
  ...from,
  id: `new${index}`,
  label: `Block ${index + 1}`,
});

describe("formatting", () => {
  it("shows 12-hour times and spans", () => {
    expect(formatTime12("13:00")).toBe("1:00 PM");
    expect(formatTime12("00:30")).toBe("12:30 AM");
    expect(formatTime12("12:00")).toBe("12:00 PM");
    expect(formatSpan("13:00", "16:00")).toBe("3 hours");
    expect(formatSpan("10:00", "11:30")).toBe("1 hour 30 min");
    expect(formatSpan("10:00", "10:45")).toBe("45 min");
  });
});

describe("timeChoices", () => {
  it("offers 30-minute steps strictly inside the bounds", () => {
    expect(timeChoices({ after: "13:00", before: "15:00" })).toEqual(["13:30", "14:00", "14:30"]);
  });

  it("keeps an off-grid time that is already set", () => {
    expect(timeChoices({ after: "13:00", before: "15:00", keep: "13:45" })).toEqual([
      "13:30",
      "13:45",
      "14:00",
      "14:30",
    ]);
  });
});

describe("fitPlan", () => {
  it("stretches a single block over the game time", () => {
    expect(times(fitPlan([block("a", "10:00", "12:00")], "13:00", "15:00"))).toEqual(["13:00-15:00"]);
  });

  it("keeps boundaries that still fit and pins the ends to the game time", () => {
    const plan = [block("a", "10:00", "12:00"), block("b", "12:00", "14:00")];
    expect(times(fitPlan(plan, "09:00", "15:00"))).toEqual(["09:00-12:00", "12:00-15:00"]);
  });

  it("merges a block squeezed out of a shorter game time", () => {
    const plan = [block("a", "10:00", "11:00"), block("b", "11:00", "12:00"), block("c", "12:00", "14:00")];
    const fitted = fitPlan(plan, "11:30", "13:00");
    expect(times(fitted)).toEqual(["11:30-12:00", "12:00-13:00"]);
    expect(fitted.map((b) => b.id)).toEqual(["b", "c"]);
  });

  it("closes gaps and sorts blocks", () => {
    const plan = [block("b", "13:00", "14:00"), block("a", "10:00", "11:00")];
    expect(times(fitPlan(plan, "10:00", "14:00"))).toEqual(["10:00-11:00", "11:00-14:00"]);
  });
});

describe("editing blocks", () => {
  const plan = [block("a", "13:00", "14:00"), block("b", "14:00", "16:00")];

  it("moves a boundary for both neighbours", () => {
    expect(times(setBlockEnd(plan, 0, "14:30"))).toEqual(["13:00-14:30", "14:30-16:00"]);
    expect(setBlockEnd(plan, 1, "15:00")).toBe(plan);
  });

  it("splits the longest block in half, copying its courts", () => {
    const split = splitBlock([block("a", "13:00", "14:00"), block("b", "14:00", "16:00", 4)], make)!;
    expect(times(split)).toEqual(["13:00-14:00", "14:00-15:00", "15:00-16:00"]);
    expect(split[2].courts).toBe(4);
  });

  it("names an added block so it doesn't repeat an existing name", () => {
    const split = splitBlock(
      [block("a", "13:00", "16:00")].map((b) => ({ ...b, label: "Block 2" })),
      make,
    )!;
    expect(split.map((b) => b.label)).toEqual(["Block 2", "Block 3"]);
  });

  it("cannot split blocks shorter than an hour", () => {
    expect(splitBlock([block("a", "13:00", "13:30")], make)).toBeNull();
  });

  it("gives a removed block's time to its neighbour", () => {
    expect(times(removeBlock(plan, 1))).toEqual(["13:00-16:00"]);
    expect(times(removeBlock(plan, 0))).toEqual(["13:00-16:00"]);
    expect(removeBlock([plan[0]], 0)).toHaveLength(1);
  });

  it("reads the game time back from the blocks", () => {
    expect(planWindow(plan)).toEqual({ start: "13:00", end: "16:00" });
  });
});

describe("planProblem", () => {
  it("accepts back-to-back blocks", () => {
    expect(planProblem([block("a", "13:00", "14:00"), block("b", "14:00", "16:00")])).toBeNull();
  });

  it("rejects backwards and overlapping blocks", () => {
    expect(planProblem([block("a", "15:00", "15:00")])).toMatch(/end after/);
    expect(planProblem([block("a", "13:00", "15:00"), block("b", "14:00", "16:00")])).toMatch(/overlap/);
    expect(planProblem([])).toMatch(/at least one/);
  });
});

describe("shiftPlanEnd (MEGA extra hour)", () => {
  it("adds an hour to the end of a single block", () => {
    expect(times(shiftPlanEnd([block("a", "10:00", "14:00")], MEGA_EXTRA_MINUTES))).toEqual(["10:00-15:00"]);
  });

  it("only lengthens the last block when there are several", () => {
    const plan = [block("a", "10:00", "12:00"), block("b", "12:00", "14:00")];
    expect(times(shiftPlanEnd(plan, MEGA_EXTRA_MINUTES))).toEqual(["10:00-12:00", "12:00-15:00"]);
  });

  it("takes the hour back when shifted by the negative amount", () => {
    expect(times(shiftPlanEnd([block("a", "10:00", "15:00")], -MEGA_EXTRA_MINUTES))).toEqual(["10:00-14:00"]);
  });

  it("never runs past the last pickable time or ends before it starts", () => {
    expect(times(shiftPlanEnd([block("a", "20:00", "23:00")], 60))).toEqual(["20:00-23:30"]);
    expect(times(shiftPlanEnd([block("a", "10:00", "10:45")], -60))).toEqual(["10:00-10:30"]);
  });
});
