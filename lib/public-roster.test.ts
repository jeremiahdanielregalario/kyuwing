import { describe, expect, it } from "vitest";
import type { AttendanceOverview, AwardsOverview } from "./queries";
import { toPublicRoster } from "./public-roster";

const players = [
  {
    id: "cuid-zed",
    nickname: "Zed",
    fullName: "Zed Santos",
    level: "B",
    category: "ALUMNI" as const,
    contact: "0917 SECRET",
    notes: "SECRET note",
    active: true,
    createdAt: new Date(),
  },
  {
    id: "cuid-amy",
    nickname: "amy",
    fullName: "  ",
    level: "C_PLUS",
    category: "ACTIVE" as const,
    contact: "amy@SECRET",
    notes: null,
    active: true,
    createdAt: new Date(),
  },
  {
    id: "cuid-old",
    nickname: "Archived",
    fullName: "SECRET Archived",
    level: "D",
    category: "INACTIVE" as const,
    contact: null,
    notes: null,
    active: false,
    createdAt: new Date(),
  },
];

const attendance: AttendanceOverview = {
  events: [],
  historyByPlayer: {
    "cuid-zed": [
      { eventId: "e1", date: "2026-11-01T00:00:00.000Z", label: null, kind: "GAMEDAY", status: "PLAYED" },
    ],
    "cuid-old": [
      { eventId: "e1", date: "2026-11-01T00:00:00.000Z", label: null, kind: "GAMEDAY", status: "PLAYED" },
    ],
  },
  byPlayer: {
    "cuid-zed": {
      score: 3,
      band: "hot",
      bandLabel: "Playing often",
      lastPlayed: "2026-11-01T00:00:00.000Z",
      daysSincePlayed: 1,
      daysSinceActive: 1,
      played90: 1,
      waitlist90: 0,
    },
  },
};

const awards: AwardsOverview = {
  tournaments: [],
  byPlayer: {
    "cuid-amy": [
      {
        tournamentId: "t1",
        tournament: "Cup",
        date: "2026-10-01T00:00:00.000Z",
        division: "C",
        place: "CHAMPION",
        teammates: ["Zed"],
      },
    ],
  },
};

describe("toPublicRoster", () => {
  const roster = toPublicRoster(players, attendance, awards);

  it("lists active players only, sorted by nickname, with aliases instead of database ids", () => {
    expect(roster.players.map((player) => [player.id, player.nickname])).toEqual([
      ["r1", "amy"],
      ["r2", "Zed"],
    ]);
  });

  it("keeps the shared fields and blanks an empty full name", () => {
    expect(roster.players[1]).toEqual({
      id: "r2",
      nickname: "Zed",
      fullName: "Zed Santos",
      level: "B",
      category: "ALUMNI",
    });
    expect(roster.players[0].fullName).toBeNull();
  });

  it("re-keys recency, history and awards by alias", () => {
    expect(Object.keys(roster.recency)).toEqual(["r2"]);
    expect(Object.keys(roster.history)).toEqual(["r2"]);
    expect(roster.awards.r1?.[0].tournament).toBe("Cup");
  });

  it("never carries contacts, notes, archived players or database ids", () => {
    const json = JSON.stringify(roster);
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("cuid-");
    expect(json).not.toContain("contact");
    expect(json).not.toContain("notes");
  });
});
