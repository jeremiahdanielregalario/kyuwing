import { describe, expect, it } from "vitest";
import type { BoardMatch } from "./board-types";
import { QUEUED_COURT } from "./datetime";
import { START_NUDGE_MS, formatWaited, gamesToStart } from "./start-reminder";

const PAIRED_AT = Date.parse("2026-06-13T10:00:00.000Z");

const game = (id: string, overrides: Partial<BoardMatch> = {}): BoardMatch => ({
  id,
  courtNumber: 1,
  round: 1,
  status: "SUGGESTED",
  free: false,
  startedAt: null,
  endedAt: null,
  changedAt: new Date(PAIRED_AT).toISOString(),
  note: null,
  team1: [],
  team2: [],
  ...overrides,
});

const none = { movedIds: [] as string[], laterIds: new Set<string>() };

describe("gamesToStart", () => {
  it("waits before reminding about a game that was just paired", () => {
    expect(gamesToStart([game("a")], { ...none, now: PAIRED_AT + START_NUDGE_MS - 1 })).toEqual([]);
  });

  it("reminds once a paired game has sat unstarted for the nudge time", () => {
    const ids = gamesToStart([game("a")], { ...none, now: PAIRED_AT + START_NUDGE_MS }).map((m) => m.id);
    expect(ids).toEqual(["a"]);
  });

  it("reminds right away about a game that moved onto a court when another ended", () => {
    const ids = gamesToStart([game("a"), game("b", { courtNumber: 2 })], {
      ...none,
      now: PAIRED_AT + 1000,
      movedIds: ["b"],
    }).map((m) => m.id);
    expect(ids).toEqual(["b"]);
  });

  it("skips live games, waiting-court games and games answered Not yet", () => {
    const later = PAIRED_AT + START_NUDGE_MS * 3;
    const games = [
      game("live", { status: "LIVE" }),
      game("waiting", { courtNumber: QUEUED_COURT }),
      game("later"),
      game("due", { courtNumber: 3 }),
    ];
    const ids = gamesToStart(games, {
      now: later,
      movedIds: ["waiting"],
      laterIds: new Set(["later"]),
    }).map((m) => m.id);
    expect(ids).toEqual(["due"]);
  });

  it("formats how long a game has waited", () => {
    expect(formatWaited(4)).toBe("4 min");
    expect(formatWaited(65)).toBe("1 h 05 min");
  });

  it("does not use the clock before it starts on the client", () => {
    expect(gamesToStart([game("a")], { ...none, now: 0 })).toEqual([]);
  });
});
