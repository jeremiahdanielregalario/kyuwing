import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatPlayTime, playTimeByPlayer, type TimedMatch } from "./play-time";

const game = (start: string, end: string | null, a: string[], b: string[]): TimedMatch => ({
  startedAt: `2026-11-02T${start}:00.000Z`,
  endedAt: end ? `2026-11-02T${end}:00.000Z` : null,
  team1: a.map((playerId) => ({ playerId })),
  team2: b.map((playerId) => ({ playerId })),
});

describe("playTimeByPlayer", () => {
  it("adds up each game's start-to-finish time for everyone in it", () => {
    const totals = playTimeByPlayer([
      game("10:00", "10:15", ["a", "b"], ["c", "d"]),
      game("10:20", "10:50", ["a", "c"], ["e", "f"]),
    ]);
    expect(totals.get("a")).toEqual({ seconds: 45 * 60, games: 2 });
    expect(totals.get("c")).toEqual({ seconds: 45 * 60, games: 2 });
    expect(totals.get("b")).toEqual({ seconds: 15 * 60, games: 1 });
    expect(totals.get("f")).toEqual({ seconds: 30 * 60, games: 1 });
  });

  it("skips games with no start or finish, or a finish before the start", () => {
    const totals = playTimeByPlayer([
      game("10:00", null, ["a"], ["b"]),
      { ...game("10:00", "10:15", ["a"], ["b"]), startedAt: null },
      game("11:00", "10:00", ["a"], ["b"]),
    ]);
    expect(totals.size).toBe(0);
  });

  it("is empty for no games", () => {
    expect(playTimeByPlayer([]).size).toBe(0);
  });
});

describe("formatPlayTime", () => {
  it("reads naturally", () => {
    expect(formatPlayTime(0)).toBe("0m");
    expect(formatPlayTime(20)).toBe("<1m");
    expect(formatPlayTime(42 * 60)).toBe("42m");
    expect(formatPlayTime(65 * 60)).toBe("1h 05m");
    expect(formatPlayTime(3 * 3600 + 30 * 60)).toBe("3h 30m");
  });
});

describe("downloadable reports", () => {
  it("do not use playing time", () => {
    for (const path of [
      "app/api/gamedays/[id]/export/pdf/route.ts",
      "app/api/gamedays/[id]/export/xlsx/route.ts",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(/play-time|playTime|PlayTime/);
    }
  });
});
