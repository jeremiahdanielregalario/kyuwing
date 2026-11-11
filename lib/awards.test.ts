import { describe, expect, it } from "vitest";
import { awardsByPlayer, parseAwardsText, splitTeam, type AwardRow } from "./awards";

const HIGH_TIDE = `High Tide 2026

Level A
Champions: Chons & Jced
Runner Up: PJ & Ben

Level B
Champions: Serafin & JP
Runner-up: Baby & JCB
`;

describe("parseAwardsText", () => {
  it("reads a pasted results message", () => {
    const parsed = parseAwardsText(HIGH_TIDE);
    expect(parsed.errors).toEqual([]);
    expect(parsed.title).toBe("High Tide 2026");
    expect(parsed.divisions).toEqual([
      {
        name: "Level A",
        results: [
          { place: "CHAMPION", names: ["Chons", "Jced"] },
          { place: "RUNNER_UP", names: ["PJ", "Ben"] },
        ],
      },
      {
        name: "Level B",
        results: [
          { place: "CHAMPION", names: ["Serafin", "JP"] },
          { place: "RUNNER_UP", names: ["Baby", "JCB"] },
        ],
      },
    ]);
  });

  it("works without a title and with other spellings", () => {
    const parsed = parseAwardsText("Level E\nChampion - Adri and Justine\n2nd: Ky / LJ");
    expect(parsed.title).toBeNull();
    expect(parsed.divisions[0].results).toEqual([
      { place: "CHAMPION", names: ["Adri", "Justine"] },
      { place: "RUNNER_UP", names: ["Ky", "LJ"] },
    ]);
  });

  it("allows a singles podium", () => {
    expect(parseAwardsText("Men's singles\nChampion: Chons").divisions[0].results).toEqual([
      { place: "CHAMPION", names: ["Chons"] },
    ]);
  });

  it("flags results with no level above them, too many names, and duplicates", () => {
    expect(parseAwardsText("Champions: A & B").errors[0]).toMatch(/level line/);
    expect(parseAwardsText("Level A\nChampions: A & B & C").errors[0]).toMatch(/one or two/);
    expect(parseAwardsText("Level A\nChampions: A & B\nChampions: C & D").errors[0]).toMatch(/two champion/);
  });

  it("says so when there are no results at all", () => {
    expect(parseAwardsText("High Tide 2026").errors[0]).toMatch(/No results/);
  });
});

describe("splitTeam", () => {
  it("splits on common separators", () => {
    expect(splitTeam("Wade & Natz")).toEqual(["Wade", "Natz"]);
    expect(splitTeam("Wade and Natz")).toEqual(["Wade", "Natz"]);
    expect(splitTeam("Wade/Natz")).toEqual(["Wade", "Natz"]);
  });
});

describe("awardsByPlayer", () => {
  const rows: AwardRow[] = [
    {
      tournamentId: "t1",
      tournament: "High Tide 2026",
      date: "2026-10-11",
      division: "Level A",
      place: "RUNNER_UP",
      position: 1,
      players: [
        { id: "pj", nickname: "PJ" },
        { id: "ben", nickname: "Ben" },
      ],
    },
    {
      tournamentId: "t0",
      tournament: "Older Cup",
      date: "2025-05-01",
      division: "Level B",
      place: "CHAMPION",
      position: 0,
      players: [{ id: "pj", nickname: "PJ" }],
    },
  ];

  it("gives each player the award with their partner's nickname", () => {
    const byPlayer = awardsByPlayer(rows);
    expect(byPlayer.ben).toEqual([
      expect.objectContaining({ tournament: "High Tide 2026", place: "RUNNER_UP", partner: "PJ" }),
    ]);
    expect(byPlayer.pj.map((award) => award.tournament)).toEqual(["High Tide 2026", "Older Cup"]);
    expect(byPlayer.pj[1].partner).toBeNull();
  });
});
