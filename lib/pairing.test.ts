import { describe, expect, it } from "vitest";
import { findBestMatch, suggestMatches, type PairingHistoryMatch, type PairingPlayer } from "./pairing";
import { levelValue } from "./levels";

function player(id: string, level: string, overrides: Partial<PairingPlayer> = {}): PairingPlayer {
  return {
    id,
    nickname: id.toUpperCase(),
    level,
    waitMinutes: 0,
    gamesPlayed: 0,
    ...overrides,
  };
}

function teamValue(team: PairingPlayer[]) {
  return team.reduce((sum, row) => sum + levelValue(row.level), 0);
}

describe("findBestMatch", () => {
  it("returns null when fewer than four players are available", () => {
    const players = [player("p1", "C"), player("p2", "C"), player("p3", "C")];
    expect(findBestMatch(players)).toBeNull();
    expect(findBestMatch([])).toBeNull();
  });

  it("balances teams when a mixed split is level on paper", () => {
    const players = [player("c1", "C+"), player("c2", "C+"), player("d1", "D"), player("d2", "D")];

    const suggestion = findBestMatch(players, [], { scarcity: false });

    expect(suggestion).not.toBeNull();
    expect(suggestion!.balance).toBe(0);
    expect(teamValue(suggestion!.team1)).toBe(teamValue(suggestion!.team2));
    // The balanced split is one stronger player with one weaker player per side.
    expect(suggestion!.team1.map((row) => row.level).sort()).toEqual(["C+", "D"]);
    expect(suggestion!.team2.map((row) => row.level).sort()).toEqual(["C+", "D"]);
  });

  it("finds a zero-gap split from four players in the same bracket", () => {
    const players = [player("p1", "C-"), player("p2", "C"), player("p3", "C"), player("p4", "C+")];

    const suggestion = findBestMatch(players, [], { scarcity: false });

    expect(suggestion).not.toBeNull();
    expect(suggestion!.balance).toBe(0);
    expect(teamValue(suggestion!.team1)).toBe(teamValue(suggestion!.team2));
    expect(suggestion!.crossBracket).toBe(false);
  });

  it("prefers the longest-waiting four when the queue is deep", () => {
    const longWait = ["p1", "p2", "p3", "p4"].map((id) => player(id, "C", { waitMinutes: 60 }));
    const shortWait = ["p5", "p6", "p7", "p8"].map((id) => player(id, "C", { waitMinutes: 1 }));

    const suggestion = findBestMatch([...shortWait, ...longWait], [], { scarcity: false });

    expect(suggestion).not.toBeNull();
    const picked = new Set(suggestion!.playerIds);
    for (const id of ["p1", "p2", "p3", "p4"]) {
      expect(picked.has(id)).toBe(true);
    }
    expect(suggestion!.averageWaitMinutes).toBe(60);
  });

  it("never splits a mutual permanent pair across the net", () => {
    const players = [
      player("ace", "A+", { permanentPartnerId: "rookie" }),
      player("rookie", "E-", { permanentPartnerId: "ace" }),
      player("mid1", "C"),
      player("mid2", "C"),
    ];

    const suggestion = findBestMatch(players, [], { scarcity: false });

    expect(suggestion).not.toBeNull();
    const aceTeam = suggestion!.team1.some((row) => row.id === "ace") ? suggestion!.team1 : suggestion!.team2;
    const rookieTeam = suggestion!.team1.some((row) => row.id === "rookie")
      ? suggestion!.team1
      : suggestion!.team2;
    expect(aceTeam).toBe(rookieTeam);
    expect(suggestion!.keepsPermanentPair).toBe(true);
  });

  it("honors a PAIR_WITH request when the match stays fair", () => {
    const players = [
      player("p1", "C+", {
        requests: [{ type: "PAIR_WITH", targetPlayerId: "p2" }],
      }),
      player("p2", "C"),
      player("p3", "C"),
      player("p4", "C-"),
    ];

    const suggestion = findBestMatch(players, [], { scarcity: false });

    expect(suggestion).not.toBeNull();
    const p1Team = suggestion!.team1.some((row) => row.id === "p1") ? 1 : 2;
    const p2Team = suggestion!.team1.some((row) => row.id === "p2") ? 1 : 2;
    expect(p1Team).toBe(p2Team);
    expect(suggestion!.honorsRequest).toBe(true);
  });

  it("puts a PLAY_AGAINST request on opposite sides of the net", () => {
    const players = [
      player("p1", "C", {
        requests: [{ type: "PLAY_AGAINST", targetPlayerId: "p2" }],
      }),
      player("p2", "C"),
      player("p3", "C"),
      player("p4", "C"),
    ];

    const suggestion = findBestMatch(players, [], { scarcity: false });

    expect(suggestion).not.toBeNull();
    const p1Team = suggestion!.team1.some((row) => row.id === "p1") ? 1 : 2;
    const p2Team = suggestion!.team1.some((row) => row.id === "p2") ? 1 : 2;
    expect(p1Team).not.toBe(p2Team);
    expect(suggestion!.honorsRequest).toBe(true);
  });

  it("avoids replaying the same foursome when alternatives exist", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].map((id) =>
      player(id, "C", { waitMinutes: 5 }),
    );
    const history: PairingHistoryMatch[] = [
      {
        round: 1,
        playerIds: ["p1", "p2", "p3", "p4"],
        team1: ["p1", "p2"],
        team2: ["p3", "p4"],
      },
    ];

    const suggestion = findBestMatch(players, history, { scarcity: false });

    expect(suggestion).not.toBeNull();
    const repeated = suggestion!.playerIds.filter((id) => ["p1", "p2", "p3", "p4"].includes(id));
    expect(repeated.length).toBeLessThan(4);
  });

  it("softens cross-bracket penalties when the queue is scarce", () => {
    const players = [player("a", "A+"), player("b", "A"), player("c", "E-"), player("d", "E")];

    const scarce = findBestMatch(players, [], { scarcity: true });
    const strict = findBestMatch(players, [], { scarcity: false });

    expect(scarce).not.toBeNull();
    expect(strict).not.toBeNull();
    expect(scarce!.crossBracket).toBe(true);
    expect(scarce!.cost).toBeLessThan(strict!.cost);
  });

  it("treats scarcity as the default below eight players", () => {
    const players = [player("a", "A+"), player("b", "A"), player("c", "E-"), player("d", "E")];
    const suggestion = findBestMatch(players);

    expect(suggestion).not.toBeNull();
    expect(suggestion!.crossBracket).toBe(true);
    expect(suggestion!.reasons.length).toBeGreaterThan(0);
  });
});

describe("suggestMatches", () => {
  it("fills multiple courts without assigning a player twice", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].map((id) =>
      player(id, "C", { waitMinutes: 10 }),
    );

    const suggestions = suggestMatches(players, [], { courts: 2, scarcity: false });

    expect(suggestions).toHaveLength(2);
    const ids = suggestions.flatMap((suggestion) => suggestion.playerIds);
    expect(new Set(ids).size).toBe(8);
    expect(ids).toHaveLength(8);
  });

  it("stops when there are not enough players for another court", () => {
    const players = ["p1", "p2", "p3", "p4", "p5"].map((id) => player(id, "C"));
    const suggestions = suggestMatches(players, [], { courts: 3 });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].playerIds).toHaveLength(4);
  });

  it("returns an empty list when fewer than four players are available", () => {
    const players = ["p1", "p2", "p3"].map((id) => player(id, "C"));
    expect(suggestMatches(players, [], { courts: 2 })).toEqual([]);
  });
});
