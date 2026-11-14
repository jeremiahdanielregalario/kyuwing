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
  addCourtForWindow,
  addCourtStartChoices,
  latestChoiceAtOrBefore,
  minutesToTime,
  type PlanBlock,
} from "./court-plan";
import { courtHours } from "./fees";

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

describe("addCourtForWindow (a court added mid-day)", () => {
  const id = (index: number) => `new-${index}`;
  const one = [{ id: "a", label: "First block", start: "17:30", end: "19:30", courts: 4 }];

  it("charges only the hour it is used: 4 courts, then 5 for an hour, then 4", () => {
    const result = addCourtForWindow(one, "18:00", "19:00", "9", id);
    if ("error" in result) throw new Error(result.error);
    expect(result.plan.map((b) => [b.id, b.label, b.start, b.end, b.courts])).toEqual([
      ["a", "First block", "17:30", "18:00", 4],
      ["new-0", "Block 2", "18:00", "19:00", 5],
      ["new-1", "Block 3", "19:00", "19:30", 4],
    ]);
    expect(result.plan[1].courtLabels).toEqual(["", "", "", "", "9"]);
    expect(result.plan[0].courtLabels).toBeUndefined();
    expect(result.added).toEqual([false, true, false]);
    expect(result.origins).toEqual([0, 0, 0]);
    expect(result.courtHours).toBe(1);
    expect(courtHours(result.plan) - courtHours(one)).toBe(1);
    expect(planProblem(result.plan)).toBeNull();
  });

  it("until the end of the reserved time splits once", () => {
    const result = addCourtForWindow(one, "18:30", "19:30", "", id);
    if ("error" in result) throw new Error(result.error);
    expect(result.plan.map((b) => [b.start, b.end, b.courts])).toEqual([
      ["17:30", "18:30", 4],
      ["18:30", "19:30", 5],
    ]);
    expect(result.courtHours).toBe(1);
  });

  it("does not split when the time covers whole blocks, and clips to the reservation", () => {
    const result = addCourtForWindow(one, "16:00", "23:00", "", id);
    if ("error" in result) throw new Error(result.error);
    expect(result.plan).toEqual([{ ...one[0], courts: 5, courtLabels: ["", "", "", "", ""] }]);
    expect(result.courtHours).toBe(2);
  });

  it("runs across blocks, keeping each block's own court names", () => {
    const plan = [
      { id: "a", label: "First block", start: "13:00", end: "14:00", courts: 2, courtLabels: ["5", "6"] },
      { id: "b", label: "Block 2", start: "14:00", end: "16:00", courts: 3 },
    ];
    const result = addCourtForWindow(plan, "13:30", "15:00", "7", id);
    if ("error" in result) throw new Error(result.error);
    expect(result.plan.map((b) => [b.id, b.label, b.start, b.end, b.courts, b.courtLabels])).toEqual([
      ["a", "First block", "13:00", "13:30", 2, ["5", "6"]],
      ["new-0", "Block 3", "13:30", "14:00", 3, ["5", "6", "7"]],
      ["b", "Block 2", "14:00", "15:00", 4, ["", "", "", "7"]],
      ["new-1", "Block 4", "15:00", "16:00", 3, undefined],
    ]);
    expect(result.added).toEqual([false, true, true, false]);
    expect(result.origins).toEqual([0, 0, 1, 1]);
    expect(result.courtHours).toBe(1.5);
    expect(plan[0].courts).toBe(2);
  });

  it("refuses bad times, full blocks and plans that would get too many blocks", () => {
    expect(addCourtForWindow(one, "19:00", "18:00", "", id)).toHaveProperty("error");
    expect(addCourtForWindow(one, "20:00", "21:00", "", id)).toHaveProperty("error");
    expect(addCourtForWindow(one, "soon", "21:00", "", id)).toHaveProperty("error");
    expect(addCourtForWindow([], "18:00", "19:00", "", id)).toHaveProperty("error");
    expect(addCourtForWindow([{ ...one[0], courts: 20 }], "18:00", "19:00", "", id)).toHaveProperty("error");
    const eight = Array.from({ length: 8 }, (_, i) => ({
      id: `b${i}`,
      label: `Block ${i + 1}`,
      start: minutesToTime(600 + i * 60),
      end: minutesToTime(660 + i * 60),
      courts: 2,
    }));
    expect(addCourtForWindow(eight, "10:30", "11:00", "", id)).toHaveProperty("error");
    expect(addCourtForWindow(eight, "10:00", "12:00", "", id)).not.toHaveProperty("error");
  });
});

describe("times offered for a mid-day court", () => {
  it("offers every half hour inside the reservation, and defaults to the one in play", () => {
    const choices = addCourtStartChoices([{ id: "a", label: "A", start: "17:45", end: "19:30", courts: 4 }]);
    expect(choices).toEqual(["17:45", "18:00", "18:30", "19:00"]);
    expect(latestChoiceAtOrBefore(choices, "18:40")).toBe("18:30");
    expect(latestChoiceAtOrBefore(choices, "16:00")).toBe("17:45");
    expect(latestChoiceAtOrBefore(choices, "22:00")).toBe("19:00");
    expect(addCourtStartChoices([])).toEqual([]);
  });
});
