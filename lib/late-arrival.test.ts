import { describe, expect, it } from "vitest";
import { gameStartInstant, missedGames } from "./late-arrival";

const start = gameStartInstant("2026-11-14T00:00:00.000Z", "17:30");
const at = (minutes: number) => new Date(start.getTime() + minutes * 60000);

describe("gameStartInstant", () => {
  it("reads the first court time in Manila", () => {
    expect(start.toISOString()).toBe("2026-11-14T09:30:00.000Z");
    expect(gameStartInstant(new Date("2026-11-14T00:00:00.000Z"), "09:00").toISOString()).toBe(
      "2026-11-14T01:00:00.000Z",
    );
  });
});

describe("missedGames", () => {
  const base = { gameStart: start, courts: 4, players: 32 };

  it("is zero for players on time, early, within the grace period, or not checked in", () => {
    expect(missedGames({ ...base, joinedAt: at(-20) })).toBe(0);
    expect(missedGames({ ...base, joinedAt: at(10) })).toBe(0);
    expect(missedGames({ ...base, joinedAt: null })).toBe(0);
  });

  it("grows with how late they are", () => {
    // 4 courts, 32 players: half of them on court at a time, a game every 15 minutes.
    expect(missedGames({ ...base, joinedAt: at(60) })).toBe(2);
    expect(missedGames({ ...base, joinedAt: at(120) })).toBe(4);
    expect(missedGames({ ...base, joinedAt: at(30) })).toBe(1);
  });

  it("follows the pace: fewer players per court means more games missed", () => {
    expect(missedGames({ ...base, players: 16, joinedAt: at(60) })).toBe(4);
    expect(missedGames({ ...base, players: 8, joinedAt: at(60) })).toBe(4);
    expect(missedGames({ ...base, courts: 0, joinedAt: at(60) })).toBe(0);
  });
});
