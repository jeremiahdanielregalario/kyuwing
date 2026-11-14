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
    fullName: "Old Timer",
    level: "D",
    category: "INACTIVE" as const,
    contact: "0918 SECRET",
    notes: "SECRET archived note",
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

  it("lists everyone sorted by nickname, flags archived players, and uses aliases instead of ids", () => {
    expect(roster.players.map((player) => [player.id, player.nickname, player.archived])).toEqual([
      ["r1", "amy", false],
      ["r2", "Archived", true],
      ["r3", "Zed", false],
    ]);
  });

  it("keeps the shared fields and blanks an empty full name", () => {
    expect(roster.players[2]).toEqual({
      id: "r3",
      nickname: "Zed",
      fullName: "Zed Santos",
      level: "B",
      category: "ALUMNI",
      archived: false,
    });
    expect(roster.players[0].fullName).toBeNull();
  });

  it("re-keys recency, history and awards by alias", () => {
    expect(Object.keys(roster.recency)).toEqual(["r3"]);
    expect(Object.keys(roster.history).sort()).toEqual(["r2", "r3"]);
    expect(roster.awards.r1?.[0].tournament).toBe("Cup");
  });

  it("never carries contacts, notes or database ids, archived players included", () => {
    const json = JSON.stringify(roster);
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("cuid-");
    expect(json).not.toContain("contact");
    expect(json).not.toContain("notes");
  });
});
