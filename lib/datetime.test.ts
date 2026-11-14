import { describe, expect, it } from "vitest";
import {
  currentSlotIndex,
  dateOnly,
  dateOnlyFromKey,
  elapsedMinutes,
  extendedPlan,
  formatClock,
  formatDuration,
  formatGameDate,
  formatGameDateShort,
  formatTimeRange,
  manilaDateKey,
  manilaTime,
  manilaWeekday,
  minutesToLabel,
  normalizeCourtLabel,
  courtName,
  FREE_GAME_WINDOW_MINUTES,
  minutesLeftInReservation,
  offersFreeGame,
  openCourts,
  parseCourtNumbers,
  parseCourtPlan,
  QUEUED_COURT,
  renamedCourt,
  reservationEnd,
  withoutCourt,
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

describe("normalizeCourtLabel", () => {
  it("stores court numbers however they are typed", () => {
    for (const typed of ["6", "Court 6", "court 6", "C6", "Court #6", " 6 "]) {
      expect(normalizeCourtLabel(typed)).toBe("6");
    }
    expect(normalizeCourtLabel("Main court")).toBe("Main court");
  });
});

describe("parseCourtNumbers", () => {
  it("reads lists, spaces, and ranges", () => {
    expect(parseCourtNumbers("5, 6, 7, 8")).toEqual(["5", "6", "7", "8"]);
    expect(parseCourtNumbers("5 6 7")).toEqual(["5", "6", "7"]);
    expect(parseCourtNumbers("5-8")).toEqual(["5", "6", "7", "8"]);
    expect(parseCourtNumbers("Court 3, Court 9")).toEqual(["3", "9"]);
    expect(parseCourtNumbers("2, 4-5")).toEqual(["2", "4", "5"]);
  });

  it("keeps names, drops blanks and duplicates", () => {
    expect(parseCourtNumbers("Main court, Side, , main court")).toEqual(["Main court", "Side"]);
    expect(parseCourtNumbers("   ")).toEqual([]);
  });
});

describe("renamedCourt", () => {
  const plan: CourtSlot[] = [
    { ...SLOTS[0], courts: 3, courtLabels: ["5", "6", "7"] },
    { ...SLOTS[1], courts: 4, courtLabels: ["5", "6", "7", "8"] },
  ];

  it("renames a court in one block only", () => {
    const result = renamedCourt(plan, 0, 2, "9", false);
    if ("error" in result) throw new Error(result.error);
    expect(courtName(result.plan[0], 2)).toBe("Court 9");
    expect(courtName(result.plan[1], 2)).toBe("Court 6");
  });

  it("renames the same position in every block", () => {
    const result = renamedCourt(plan, 0, 1, "Main", true);
    if ("error" in result) throw new Error(result.error);
    expect(courtName(result.plan[0], 1)).toBe("Main");
    expect(courtName(result.plan[1], 1)).toBe("Main");
  });

  it("falls back to the position number when cleared", () => {
    const result = renamedCourt(plan, 0, 3, "  ", false);
    if ("error" in result) throw new Error(result.error);
    expect(courtName(result.plan[0], 3)).toBe("Court 3");
  });

  it("refuses a name another court in the block already uses", () => {
    const result = renamedCourt(plan, 0, 1, "court 6", false);
    expect(result).toEqual({ error: "Court 6 is already a court in Morning." });
    expect(renamedCourt(plan, 0, 1, "6", false)).toEqual({ error: "Court 6 is already a court in Morning." });
  });
});

describe("withoutCourt", () => {
  it("drops a labelled court and keeps the others' names", () => {
    const slot: CourtSlot = { ...SLOTS[0], courts: 4, courtLabels: ["5", "6", "7", "8"] };
    const next = withoutCourt(slot, 2);
    expect(next.courts).toBe(3);
    expect([1, 2, 3].map((court) => courtName(next, court))).toEqual(["Court 5", "Court 7", "Court 8"]);
  });

  it("freezes positional names so unnamed courts are not renumbered", () => {
    const next = withoutCourt({ ...SLOTS[0], courts: 4 }, 2);
    expect([1, 2, 3].map((court) => courtName(next, court))).toEqual(["Court 1", "Court 3", "Court 4"]);
  });

  it("keeps custom names", () => {
    const next = withoutCourt({ ...SLOTS[0], courts: 3, courtLabels: ["Main", "", "Side"] }, 1);
    expect([1, 2].map((court) => courtName(next, court))).toEqual(["Court 2", "Side"]);
  });
});

describe("extending the reservation", () => {
  const plan: CourtSlot[] = [
    { id: "a", label: "First", start: "10:00", end: "12:00", courts: 3, courtLabels: ["5", "6", "7"] },
    { id: "b", label: "Second", start: "12:00", end: "14:00", courts: 4, courtLabels: ["5", "6", "7", "8"] },
  ];

  it("finds the reservation end", () => {
    expect(reservationEnd(plan)).toBe("14:00");
    expect(reservationEnd([])).toBeNull();
  });

  it("adds a block from the end, keeping court numbers", () => {
    const result = extendedPlan(plan, "15:00", 2);
    if ("error" in result) throw new Error(result.error);
    expect(result.index).toBe(2);
    expect(result.plan[2]).toMatchObject({ label: "Extension", start: "14:00", end: "15:00", courts: 2 });
    expect([1, 2].map((court) => courtName(result.plan[2], court))).toEqual(["Court 5", "Court 6"]);
  });

  it("continues numbered courts when adding more", () => {
    const result = extendedPlan(plan, "15:00", 5);
    if ("error" in result) throw new Error(result.error);
    expect(result.plan[2].courtLabels).toEqual(["5", "6", "7", "8", "9"]);
  });

  it("names a second extension and checks the time", () => {
    const first = extendedPlan(plan, "15:00", 2);
    if ("error" in first) throw new Error(first.error);
    const second = extendedPlan(first.plan, "16:00", 2);
    if ("error" in second) throw new Error(second.error);
    expect(second.plan[3]).toMatchObject({ label: "Extension 2", start: "15:00" });
    expect(extendedPlan(plan, "13:30", 2)).toEqual({ error: "Pick a time after 14:00." });
    expect(extendedPlan(plan, "15:00", 0)).toEqual({ error: "Pick between 1 and 20 courts." });
  });
});

describe("free games near closing time", () => {
  // 13:50 Manila on Nov 2, 2026; the reservation ends 14:00.
  const NOW = new Date("2026-11-02T05:50:00.000Z");
  const PLAN: CourtSlot[] = [
    { id: "a", label: "First", start: "10:00", end: "12:00", courts: 3 },
    { id: "b", label: "Second", start: "12:00", end: "14:00", courts: 4 },
  ];

  it("counts minutes to the latest block end on the game day", () => {
    expect(minutesLeftInReservation(PLAN, "2026-11-02T00:00:00.000Z", NOW)).toBe(10);
    expect(offersFreeGame(10)).toBe(true);
  });

  it("does not offer a free game earlier in the day", () => {
    const early = new Date("2026-11-02T04:00:00.000Z"); // 12:00 Manila
    expect(offersFreeGame(minutesLeftInReservation(PLAN, "2026-11-02T00:00:00.000Z", early))).toBe(false);
    expect(FREE_GAME_WINDOW_MINUTES).toBe(15);
  });

  it("ignores game days that are not today", () => {
    expect(minutesLeftInReservation(PLAN, "2026-10-26T00:00:00.000Z", NOW)).toBeNull();
    expect(offersFreeGame(null)).toBe(false);
  });
});

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
    expect(formatTimeRange("09:00", "14:00")).toBe("9:00 AM–2:00 PM");
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
