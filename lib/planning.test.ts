import { describe, expect, it } from "vitest";
import {
  GAME_MINUTES,
  courtFreeAt,
  isFreeBy,
  lineTimes,
  moveInLine,
  planTimeline,
  playerAvailableAt,
} from "./planning";

const MIN = 60_000;
const now = Date.parse("2026-11-04T10:00:00Z");

describe("courtFreeAt", () => {
  it("is the start plus a game, but never in the past", () => {
    expect(courtFreeAt({ courtNumber: 1, startedAt: now - 5 * MIN }, now)).toBe(
      now + (GAME_MINUTES - 5) * MIN,
    );
    expect(courtFreeAt({ courtNumber: 1, startedAt: now - 40 * MIN }, now)).toBe(now);
  });

  it("assumes a game that is assigned but not started begins now", () => {
    expect(courtFreeAt({ courtNumber: 1, startedAt: null }, now)).toBe(now + GAME_MINUTES * MIN);
  });
});

describe("planTimeline", () => {
  it("starts the next game on the first court to free up", () => {
    const timeline = planTimeline({
      now,
      totalCourts: 2,
      busy: [
        { courtNumber: 1, startedAt: now - 10 * MIN },
        { courtNumber: 2, startedAt: now - 2 * MIN },
      ],
      queuedGames: 0,
    });
    expect(timeline.starts).toEqual([]);
    expect(timeline.nextStart).toBe(now + 5 * MIN);
  });

  it("chains waiting games over the courts in order", () => {
    const timeline = planTimeline({
      now,
      totalCourts: 2,
      busy: [
        { courtNumber: 1, startedAt: now - 10 * MIN },
        { courtNumber: 2, startedAt: now - 5 * MIN },
      ],
      queuedGames: 3,
    });
    // Court 1 frees at +5, court 2 at +10, then court 1 again at +20.
    expect(timeline.starts).toEqual([now + 5 * MIN, now + 10 * MIN, now + 20 * MIN]);
    expect(timeline.nextStart).toBe(now + 25 * MIN);
  });

  it("treats an open court as free now", () => {
    expect(
      planTimeline({ now, totalCourts: 3, busy: [{ courtNumber: 1, startedAt: now }], queuedGames: 0 })
        .nextStart,
    ).toBe(now);
  });

  it("copes with no courts at all", () => {
    expect(planTimeline({ now, totalCourts: 0, busy: [], queuedGames: 1 }).starts).toHaveLength(1);
  });
});

describe("player availability", () => {
  it("is now for someone who is not in a game", () => {
    expect(playerAvailableAt({ now, liveStartedAt: null, plannedStarts: [] })).toBe(now);
  });

  it("is the end of the live game they are in", () => {
    expect(playerAvailableAt({ now, liveStartedAt: now - 10 * MIN, plannedStarts: [] })).toBe(now + 5 * MIN);
  });

  it("is the end of the latest waiting game they are planned for", () => {
    expect(
      playerAvailableAt({ now, liveStartedAt: null, plannedStarts: [now + 5 * MIN, now + 20 * MIN] }),
    ).toBe(now + 35 * MIN);
  });

  it("lets someone finishing just before a game's start be put in it, but not someone still playing", () => {
    expect(isFreeBy(now + 5 * MIN, now + 5 * MIN)).toBe(true);
    expect(isFreeBy(now + 6 * MIN, now + 5 * MIN)).toBe(false);
  });

  it("6 players, 4 on court: the 2 waiting plus 2 finishing in time can be planned together", () => {
    const start = planTimeline({
      now,
      totalCourts: 1,
      busy: [{ courtNumber: 1, startedAt: now - 5 * MIN }],
      queuedGames: 0,
    }).nextStart;
    const finishing = playerAvailableAt({ now, liveStartedAt: now - 5 * MIN, plannedStarts: [] });
    expect(isFreeBy(now, start)).toBe(true); // the two who are waiting
    expect(isFreeBy(finishing, start)).toBe(true); // the four on court, done exactly when the court frees
  });
});

describe("moveInLine", () => {
  const line = ["a", "b", "c", "d"];

  it("moves a game up, down, to the front and to the back", () => {
    expect(moveInLine(line, "c", 1)).toEqual(["a", "c", "b", "d"]);
    expect(moveInLine(line, "a", 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveInLine(line, "d", 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveInLine(line, "a", 3)).toEqual(["b", "c", "d", "a"]);
  });

  it("clamps the position, and returns null when nothing changes", () => {
    expect(moveInLine(line, "a", 99)).toEqual(["b", "c", "d", "a"]);
    expect(moveInLine(line, "b", -5)).toEqual(["b", "a", "c", "d"]);
    expect(moveInLine(line, "b", 1)).toBeNull();
    expect(moveInLine(line, "zzz", 0)).toBeNull();
  });
});

describe("lineTimes", () => {
  it("keeps the same times, in order", () => {
    expect(lineTimes([30, 10, 20])).toEqual([10, 20, 30]);
  });

  it("breaks ties so the order is never ambiguous", () => {
    expect(lineTimes([10, 10, 10])).toEqual([10, 11, 12]);
  });
});
