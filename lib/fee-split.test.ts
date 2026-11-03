import { describe, expect, it } from "vitest";
import { buildFeeSchedule, courtCost, courtHours } from "./fees";

const plan = [
  { start: "10:00", end: "12:00", courts: 3 },
  { start: "12:00", end: "14:00", courts: 4 },
];

describe("court cost", () => {
  it("is hours × courts summed over blocks", () => {
    expect(courtHours(plan)).toBe(14);
    expect(courtCost(plan, 200)).toBe(2800);
  });

  it("handles half hours", () => {
    expect(courtCost([{ start: "10:00", end: "11:30", courts: 2 }], 300)).toBe(900);
  });
});

describe("split fee schedule", () => {
  const split = (attendees: number) =>
    buildFeeSchedule({ type: "REGULAR", courtPlan: plan, ratePerCourtHour: 200, attendees, rules: [] });

  it("divides the court cost among players, rounded up to the next peso", () => {
    expect(split(30).split?.flatFee).toBe(94); // 2800 / 30 = 93.33
    expect(split(28).split?.flatFee).toBe(100);
  });

  it("charges shuttles per game by category on top of the same flat share", () => {
    const schedule = split(28);
    expect(schedule.feeFor("ACTIVE", 3)).toEqual({ flatFee: 100, perGameFee: 20, total: 160 });
    expect(schedule.feeFor("ALUMNI", 2).total).toBe(150);
    expect(schedule.feeFor("INACTIVE", 2).total).toBe(150);
    expect(schedule.feeFor("APPLICANT", 2).total).toBe(150);
    expect(schedule.feeFor("NON_AFFILIATE", 2).total).toBe(160);
  });

  it("charges only the flat share to someone who has not played a game", () => {
    expect(split(28).feeFor("ACTIVE", 0).total).toBe(100);
  });

  it("has no flat fee until someone checks in", () => {
    expect(split(0).split?.flatFee).toBe(0);
  });
});

describe("venue fee schedule", () => {
  it("uses the venue rules when the game day has no court rate", () => {
    const schedule = buildFeeSchedule({
      type: "REGULAR",
      courtPlan: plan,
      ratePerCourtHour: null,
      attendees: 20,
      rules: [{ dayType: "REGULAR", category: "ACTIVE", flatFee: 250, perGameFee: 50 }],
    });
    expect(schedule.mode).toBe("VENUE");
    expect(schedule.feeFor("ACTIVE", 2).total).toBe(350);
    expect(schedule.feeFor("ALUMNI", 2).total).toBe(0);
  });
});
