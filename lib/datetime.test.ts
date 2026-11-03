import { describe, expect, it } from "vitest";
import {
  currentSlotIndex,
  dateOnly,
  dateOnlyFromKey,
  elapsedMinutes,
  formatClock,
  formatDuration,
  formatGameDate,
  formatGameDateShort,
  formatTimeRange,
  manilaDateKey,
  manilaTime,
  manilaWeekday,
  minutesToLabel,
  courtName,
  openCourts,
  parseCourtPlan,
  QUEUED_COURT,
  timeToMinutes,
  weekdayFromKey,
  weekdayLabel,
  type CourtSlot,
} from "./datetime";

const SLOTS: CourtSlot[] = [
  { id: "a", label: "Morning", start: "09:00", end: "10:00", courts: 3 },
  { id: "b", label: "Midday", start: "10:00", end: "12:00", courts: 4 },
  { id: "c", label: "Afternoon", start: "12:00", end: "14:00", courts: 2 },
];

describe("queued games", () => {
  it("names the queue slot Next up", () => {
    expect(courtName(SLOTS[0], QUEUED_COURT)).toBe("Next up");
  });

  it("lists open courts lowest first, ignoring the queue", () => {
    expect(openCourts(4, [2, QUEUED_COURT, 3])).toEqual([1, 4]);
    expect(openCourts(2, [1, 2])).toEqual([]);
  });
});

describe("courtName", () => {
  it("falls back to the position number", () => {
    expect(courtName(undefined, 3)).toBe("Court 3");
    expect(courtName(SLOTS[0], 2)).toBe("Court 2");
  });

  it("uses a custom label when present", () => {
    const slot: CourtSlot = { ...SLOTS[0], courtLabels: ["Court 5", "", "Reserved A"] };
    expect(courtName(slot, 1)).toBe("Court 5");
    expect(courtName({ ...SLOTS[0], courtLabels: ["7"] }, 1)).toBe("Court 7");
    expect(courtName({ ...SLOTS[0], courtLabels: ["Reserved A"] }, 1)).toBe("Reserved A");
    expect(courtName(slot, 2)).toBe("Court 2");
    expect(courtName(slot, 3)).toBe("Reserved A");
    expect(courtName(slot, 4)).toBe("Court 4");
  });
});

describe("parseCourtPlan", () => {
  it("returns an empty plan for non-array input", () => {
    expect(parseCourtPlan(null)).toEqual([]);
    expect(parseCourtPlan(undefined)).toEqual([]);
    expect(parseCourtPlan({})).toEqual([]);
    expect(parseCourtPlan("nope")).toEqual([]);
  });

  it("keeps valid slots and fills in defaults", () => {
    const plan = parseCourtPlan([{ start: "09:00", end: "11:00", courts: 3 }]);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ start: "09:00", end: "11:00", courts: 3 });
    expect(plan[0].id).toBe("slot-1");
    expect(plan[0].label).toBe("Slot 1");
  });

  it("clamps court counts into a practical range", () => {
    const plan = parseCourtPlan([
      { courts: 0 },
      { courts: -4 },
      { courts: 99 },
      { courts: "6" },
      { courts: "abc" },
    ]);
    expect(plan.map((slot) => slot.courts)).toEqual([1, 1, 20, 6, 1]);
  });

  it("skips entries that are not objects", () => {
    const plan = parseCourtPlan([null, 5, "x", { courts: 2 }]);
    expect(plan).toHaveLength(1);
  });

  it("keeps court labels when provided", () => {
    const plan = parseCourtPlan([
      {
        id: "a",
        label: "Block",
        start: "10:00",
        end: "12:00",
        courts: 2,
        courtLabels: ["Court 5", " Court 6 "],
      },
    ]);
    expect(plan[0].courtLabels).toEqual(["Court 5", "Court 6"]);
    const blank = parseCourtPlan([{ start: "10:00", end: "12:00", courts: 2, courtLabels: ["", " "] }]);
    expect(blank[0].courtLabels).toBeUndefined();
  });
});

describe("currentSlotIndex", () => {
  it("returns 0 for an empty plan", () => {
    expect(currentSlotIndex([], new Date())).toBe(0);
  });

  it("finds the slot covering the current Manila time", () => {
    // 10:30 Manila = 02:30 UTC
    expect(currentSlotIndex(SLOTS, new Date("2026-11-02T02:30:00.000Z"))).toBe(1);
  });

  it("treats the end boundary as exclusive", () => {
    // 10:00 Manila exactly = 02:00 UTC -> slot b starts
    expect(currentSlotIndex(SLOTS, new Date("2026-11-02T02:00:00.000Z"))).toBe(1);
  });

  it("picks the next upcoming slot when between sessions", () => {
    // 08:00 Manila = 00:00 UTC -> before the first slot
    expect(currentSlotIndex(SLOTS, new Date("2026-11-02T00:00:00.000Z"))).toBe(0);
  });

  it("falls back to the first slot after the last block ends", () => {
    // 20:00 Manila = 12:00 UTC -> after the last slot
    expect(currentSlotIndex(SLOTS, new Date("2026-11-02T12:00:00.000Z"))).toBe(0);
  });
});

describe("time helpers", () => {
  it("converts HH:mm to minutes", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("14:00")).toBe(840);
    expect(timeToMinutes("bad")).toBe(0);
  });

  it("formats minutes as a compact label", () => {
    expect(minutesToLabel(0)).toBe("0m");
    expect(minutesToLabel(45)).toBe("45m");
    expect(minutesToLabel(60)).toBe("1h");
    expect(minutesToLabel(90)).toBe("1h 30m");
    expect(minutesToLabel(-20)).toBe("0m");
  });

  it("formats a duration as a timer", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(-10)).toBe("0:00");
  });

  it("formats a time range", () => {
    expect(formatTimeRange("09:00", "14:00")).toBe("09:00–14:00");
  });

  it("computes elapsed minutes without going negative", () => {
    const start = new Date("2026-11-02T01:00:00.000Z");
    const end = new Date("2026-11-02T02:30:00.000Z");
    expect(elapsedMinutes(start, end)).toBe(90);
    expect(elapsedMinutes(end, start)).toBe(0);
    expect(elapsedMinutes(null, end)).toBe(0);
  });

  it("labels weekdays", () => {
    expect(weekdayLabel(1)).toBe("Monday");
    expect(weekdayLabel(6)).toBe("Saturday");
    expect(weekdayLabel(99)).toBe("");
  });
});

describe("Manila dates", () => {
  it("reports the Manila date even when UTC is still the previous day", () => {
    // 2026-11-01 17:00 UTC = 2026-11-02 01:00 Manila
    const instant = new Date("2026-11-01T17:00:00.000Z");
    expect(manilaDateKey(instant)).toBe("2026-11-02");
    expect(manilaTime(instant)).toBe("01:00");
    expect(manilaWeekday(instant)).toBe(1);
  });

  it("stores date-only values at UTC midnight", () => {
    const instant = new Date("2026-11-01T17:00:00.000Z");
    expect(dateOnly(instant).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(dateOnlyFromKey("2026-11-02").toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("formats a game date without shifting the day", () => {
    const stored = dateOnlyFromKey("2026-11-02");
    expect(formatGameDate(stored)).toBe("Nov 2, 2026");
    expect(formatGameDate(stored, { weekday: true })).toBe("Monday, Nov 2, 2026");
    expect(formatGameDateShort(stored)).toBe("Nov 2");
  });

  it("derives the weekday from a stored date key", () => {
    expect(weekdayFromKey("2026-11-02")).toBe(1);
    expect(weekdayFromKey("2026-11-07")).toBe(6);
  });

  it("formats the clock in Manila time", () => {
    expect(formatClock("2026-11-02T01:30:00.000Z")).toBe("9:30 AM");
  });
});
