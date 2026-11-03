import { describe, expect, it } from "vitest";
import { recencySummary } from "./recency";

const NOW = new Date("2026-11-03T00:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

describe("recencySummary", () => {
  it("returns a no-history band when nothing is logged", () => {
    const summary = recencySummary([], NOW);
    expect(summary.band).toBe("new");
    expect(summary.score).toBe(0);
    expect(summary.daysSincePlayed).toBeNull();
  });

  it("scores a recent regular higher than an occasional player", () => {
    const regular = recencySummary(
      [0, 7, 14, 21, 28].map((days) => ({ date: daysAgo(days), status: "PLAYED" as const })),
      NOW,
    );
    const occasional = recencySummary([{ date: daysAgo(20), status: "PLAYED" }], NOW);
    expect(regular.score).toBeGreaterThan(occasional.score);
    expect(regular.band).toBe("hot");
  });

  it("treats one recent game as playing, not cooling off", () => {
    const summary = recencySummary([{ date: daysAgo(1), status: "PLAYED" }], NOW);
    expect(summary.band).toBe("warm");
    expect(summary.daysSinceActive).toBe(1);
  });

  it("counts a recent waitlist place as still wanting to play", () => {
    const summary = recencySummary([{ date: daysAgo(2), status: "WAITLIST" }], NOW);
    expect(summary.band).toBe("warm");
    expect(summary.daysSincePlayed).toBeNull();
    expect(summary.daysSinceActive).toBe(2);
  });

  it("marks players unseen for one to three months as cooling off", () => {
    const summary = recencySummary(
      [0, 7, 14, 21].map((days) => ({ date: daysAgo(days + 50), status: "PLAYED" as const })),
      NOW,
    );
    expect(summary.band).toBe("cooling");
  });

  it("marks players seen only at a recent tournament as tournament only", () => {
    const summary = recencySummary([{ date: daysAgo(23), status: "PLAYED", kind: "TOURNAMENT" }], NOW);
    expect(summary.band).toBe("tournament");
  });

  it("drops the tournament-only label once they also play a game day", () => {
    const summary = recencySummary(
      [
        { date: daysAgo(23), status: "PLAYED", kind: "TOURNAMENT" },
        { date: daysAgo(5), status: "PLAYED", kind: "GAMEDAY" },
      ],
      NOW,
    );
    expect(summary.band).toBe("warm");
  });

  it("still lets tournament-only players go dormant", () => {
    const summary = recencySummary([{ date: daysAgo(120), status: "PLAYED", kind: "TOURNAMENT" }], NOW);
    expect(summary.band).toBe("dormant");
  });

  it("counts a waitlist place for less than playing", () => {
    const played = recencySummary([{ date: daysAgo(10), status: "PLAYED" }], NOW);
    const waitlisted = recencySummary([{ date: daysAgo(10), status: "WAITLIST" }], NOW);
    expect(waitlisted.score).toBeLessThan(played.score);
    expect(waitlisted.score).toBeGreaterThan(0);
  });

  it("fades players who stopped showing up", () => {
    const recent = recencySummary([{ date: daysAgo(30), status: "PLAYED" }], NOW);
    const old = recencySummary([{ date: daysAgo(180), status: "PLAYED" }], NOW);
    expect(old.score).toBeLessThan(recent.score);
    expect(old.band).toBe("dormant");
  });

  it("counts sessions in the last 90 days separately from the score", () => {
    const summary = recencySummary(
      [
        { date: daysAgo(10), status: "PLAYED" },
        { date: daysAgo(80), status: "PLAYED" },
        { date: daysAgo(120), status: "PLAYED" },
        { date: daysAgo(30), status: "WAITLIST" },
      ],
      NOW,
    );
    expect(summary.played90).toBe(2);
    expect(summary.waitlist90).toBe(1);
    expect(summary.totalPlayed).toBe(3);
    expect(summary.totalEvents).toBe(4);
  });

  it("ignores events older than the scoring window but keeps the history", () => {
    const summary = recencySummary([{ date: daysAgo(400), status: "PLAYED" }], NOW);
    expect(summary.score).toBe(0);
    expect(summary.band).toBe("dormant");
    expect(summary.totalPlayed).toBe(1);
    expect(summary.daysSincePlayed).toBe(400);
  });

  it("reports days since the most recent game, not waitlist place", () => {
    const summary = recencySummary(
      [
        { date: daysAgo(90), status: "PLAYED" },
        { date: daysAgo(3), status: "WAITLIST" },
      ],
      NOW,
    );
    expect(summary.daysSincePlayed).toBe(90);
    expect(summary.lastWaitlist).not.toBeNull();
  });
});
