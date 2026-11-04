import { describe, expect, it } from "vitest";
import {
  arrangementKey,
  findBestMatch,
  suggestMatches,
  type PairingHistoryMatch,
  type PairingPlayer,
} from "./pairing";
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

describe("regenerating with variety", () => {
  const eight = ["C+", "C", "C", "C-", "C+", "C", "C-", "C"].map((level, index) =>
    player(`p${index}`, level),
  );
  const keyOf = (suggestion: NonNullable<ReturnType<typeof findBestMatch>>) =>
    arrangementKey(
      suggestion.team1.map((row) => row.id),
      suggestion.team2.map((row) => row.id),
    );

  it("is unchanged when no variety is asked for", () => {
    expect(findBestMatch(eight, [], { scarcity: false })).toEqual(
      findBestMatch(eight, [], { scarcity: false }),
    );
  });

  it("never returns an arrangement it was told to avoid", () => {
    const first = findBestMatch(eight, [], { scarcity: false })!;
    const second = findBestMatch(eight, [], {
      scarcity: false,
      variety: { seed: 1, avoid: [keyOf(first)] },
    })!;
    expect(keyOf(second)).not.toBe(keyOf(first));
  });

  it("keeps cycling through new arrangements as each one is rejected", () => {
    const seen: string[] = [];
    for (let seed = 1; seed <= 6; seed += 1) {
      const next = findBestMatch(eight, [], { scarcity: false, variety: { seed, avoid: seen } });
      expect(next).not.toBeNull();
      const key = keyOf(next!);
      expect(seen).not.toContain(key);
      seen.push(key);
    }
  });

  it("stays reasonably fair: teams within one level step even after several rejections", () => {
    const seen: string[] = [];
    for (let seed = 1; seed <= 4; seed += 1) {
      const next = findBestMatch(eight, [], { scarcity: false, variety: { seed, avoid: seen } })!;
      seen.push(keyOf(next));
      expect(Math.abs(teamValue(next.team1) - teamValue(next.team2))).toBeLessThanOrEqual(2);
    }
  });

  it("is repeatable for the same seed", () => {
    const a = findBestMatch(eight, [], { scarcity: false, variety: { seed: 7 } })!;
    const b = findBestMatch(eight, [], { scarcity: false, variety: { seed: 7 } })!;
    expect(keyOf(a)).toBe(keyOf(b));
  });

  it("returns null when every arrangement of the only four players was rejected", () => {
    const four = ["C", "C+", "C-", "C"].map((level, index) => player(`q${index}`, level));
    const avoid: string[] = [];
    for (const [a, b] of [
      [
        ["q0", "q1"],
        ["q2", "q3"],
      ],
      [
        ["q0", "q2"],
        ["q1", "q3"],
      ],
      [
        ["q0", "q3"],
        ["q1", "q2"],
      ],
    ])
      avoid.push(arrangementKey(a, b));
    expect(findBestMatch(four, [], { variety: { seed: 3, avoid } })).toBeNull();
  });
});

describe("must include", () => {
  const players = [
    player("w1", "C"),
    player("w2", "C+"),
    player("o1", "C"),
    player("o2", "C"),
    player("o3", "C-"),
    player("o4", "C"),
  ];

  it("always puts the required players in the match", () => {
    const suggestion = findBestMatch(players, [], { scarcity: false, mustInclude: ["w1", "w2"] })!;
    expect(suggestion.playerIds).toEqual(expect.arrayContaining(["w1", "w2"]));
    expect(suggestion.playerIds).toHaveLength(4);
  });

  it("returns null when the required players cannot all fit", () => {
    expect(findBestMatch(players, [], { mustInclude: ["w1", "w2", "o1", "o2", "o3"] })).toBeNull();
  });

  it("is unchanged when nobody is required", () => {
    expect(findBestMatch(players, [], { scarcity: false, mustInclude: [] })).toEqual(
      findBestMatch(players, [], { scarcity: false }),
    );
  });
});

describe("placed players (sides)", () => {
  const players = [
    player("a", "C"),
    player("b", "C+"),
    player("c", "C"),
    player("d", "C-"),
    player("e", "C"),
    player("f", "C+"),
  ];
  const teamOf = (suggestion: NonNullable<ReturnType<typeof findBestMatch>>, id: string) =>
    suggestion.team1.some((row) => row.id === id) ? 1 : 2;

  it("keeps two players placed on the same side as partners", () => {
    const suggestion = findBestMatch(players, [], {
      scarcity: false,
      mustInclude: ["a", "b"],
      sides: { a: 1, b: 1 },
    })!;
    expect(teamOf(suggestion, "a")).toBe(1);
    expect(teamOf(suggestion, "b")).toBe(1);
  });

  it("keeps players placed on different sides as opponents, on the sides they were put", () => {
    const suggestion = findBestMatch(players, [], {
      scarcity: false,
      mustInclude: ["a", "b"],
      sides: { a: 2, b: 1 },
    })!;
    expect(teamOf(suggestion, "a")).toBe(2);
    expect(teamOf(suggestion, "b")).toBe(1);
  });

  it("fills the remaining slots with other players", () => {
    const suggestion = findBestMatch(players, [], { scarcity: false, mustInclude: ["a"], sides: { a: 1 } })!;
    expect(suggestion.playerIds).toContain("a");
    expect(suggestion.playerIds).toHaveLength(4);
    expect(new Set(suggestion.playerIds).size).toBe(4);
  });

  it("puts a lone placed player on the side they were put", () => {
    expect(teamOf(findBestMatch(players, [], { mustInclude: ["d"], sides: { d: 2 } })!, "d")).toBe(2);
    expect(teamOf(findBestMatch(players, [], { mustInclude: ["d"], sides: { d: 1 } })!, "d")).toBe(1);
  });

  it("is unchanged without placements", () => {
    expect(findBestMatch(players, [], { scarcity: false, sides: {} })).toEqual(
      findBestMatch(players, [], { scarcity: false }),
    );
  });
});
