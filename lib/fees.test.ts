import { describe, expect, it } from "vitest";
import {
  buildFeeSchedule,
  computeFee,
  formatPeso,
  formatPesoPdf,
  GAMEDAY_TYPE_LABELS,
  CATEGORY_LABELS,
} from "./fees";
import { courtHoursSchema } from "./validation";

describe("computeFee", () => {
  it("returns zero when there is no rule for the player's category and day type", () => {
    expect(computeFee(null, 3)).toBe(0);
    expect(computeFee(undefined, 3)).toBe(0);
  });

  it("charges the flat fee when zero games were played", () => {
    expect(computeFee({ flatFee: 100, perGameFee: 25 }, 0)).toBe(100);
  });

  it("adds flat fee plus per-game rate", () => {
    expect(computeFee({ flatFee: 100, perGameFee: 25 }, 4)).toBe(200);
    expect(computeFee({ flatFee: 0, perGameFee: 30 }, 3)).toBe(90);
    expect(computeFee({ flatFee: 150, perGameFee: 0 }, 5)).toBe(150);
  });

  it("never charges negative games", () => {
    expect(computeFee({ flatFee: 50, perGameFee: 10 }, -2)).toBe(50);
  });

  it("supports fractional rates without rounding internally", () => {
    expect(computeFee({ flatFee: 99.5, perGameFee: 12.25 }, 2)).toBe(124);
  });
});

describe("formatPeso", () => {
  it("uses the peso sign and no decimals", () => {
    expect(formatPeso(0)).toBe("₱0");
    expect(formatPeso(250)).toBe("₱250");
  });

  it("adds thousands separators", () => {
    expect(formatPeso(1250)).toBe("₱1,250");
    expect(formatPeso(100000)).toBe("₱100,000");
  });

  it("rounds to the nearest peso", () => {
    expect(formatPeso(199.6)).toBe("₱200");
  });

  it("formats negative adjustments", () => {
    expect(formatPeso(-250)).toBe("-₱250");
  });
});

describe("formatPesoPdf", () => {
  it("uses PHP because standard PDF fonts lack the peso glyph", () => {
    expect(formatPesoPdf(0)).toBe("PHP 0");
    expect(formatPesoPdf(1250)).toBe("PHP 1,250");
    expect(formatPesoPdf(1250)).not.toContain("₱");
  });
});

describe("labels", () => {
  it("covers every game day type", () => {
    expect(GAMEDAY_TYPE_LABELS.REGULAR).toBe("Regular game day");
    expect(GAMEDAY_TYPE_LABELS.TIPID).toBe("Tipid game day");
    expect(GAMEDAY_TYPE_LABELS.MEGA).toBe("MEGA game day");
  });

  it("covers every player category", () => {
    expect(CATEGORY_LABELS.ACTIVE).toBe("Active member");
    expect(CATEGORY_LABELS.INACTIVE).toBe("Inactive");
    expect(CATEGORY_LABELS.ALUMNI).toBe("Alumni");
    expect(CATEGORY_LABELS.APPLICANT).toBe("Applicant");
    expect(CATEGORY_LABELS.NON_AFFILIATE).toBe("Non-affiliate");
  });
});

describe("buildFeeSchedule court-hours override", () => {
  const plan = [{ start: "11:00", end: "15:00", courts: 3 }];
  const base = { courtPlan: plan, ratePerCourtHour: 300, venueShortName: "DASC", attendees: 51 };

  it("works the cost out from the court plan by default", () => {
    const { split } = buildFeeSchedule(base);
    expect(split).toMatchObject({
      courtHours: 12,
      plannedCourtHours: 12,
      courtHoursOverridden: false,
      courtCost: 3600,
    });
  });

  it("uses the queue master's court-hours instead of the plan's", () => {
    const { split } = buildFeeSchedule({ ...base, courtHoursOverride: 3 });
    expect(split).toMatchObject({
      courtHours: 3,
      plannedCourtHours: 12,
      courtHoursOverridden: true,
      courtCost: 900,
    });
    // ₱900 ÷ 51 = ₱17.65, rounded up to ₱20.
    expect(split.flatFee).toBe(20);
  });

  it("ignores an empty or zero override", () => {
    expect(buildFeeSchedule({ ...base, courtHoursOverride: null }).split.courtHours).toBe(12);
    expect(buildFeeSchedule({ ...base, courtHoursOverride: 0 }).split.courtHours).toBe(12);
  });
});

describe("courtHoursSchema", () => {
  it("takes whole, half and quarter hours, or null to follow the plan", () => {
    expect(courtHoursSchema.parse(7.5)).toBe(7.5);
    expect(courtHoursSchema.parse(null)).toBeNull();
    expect(courtHoursSchema.safeParse(0).success).toBe(false);
    expect(courtHoursSchema.safeParse(7.3).success).toBe(false);
  });
});
