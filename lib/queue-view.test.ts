import { describe, expect, it } from "vitest";
import { UNRATED_LEVEL, levelLabel, LEVELS } from "./levels";
import { byBracket, shortPlace, waitingList, type QueueState } from "./queue-view";

const key = (label: string) => LEVELS.find((level) => level.label === label)!.key as string;

describe("waitingList", () => {
  const players: Array<{ name: string; state: QueueState }> = [
    { name: "Mika", state: "playing" },
    { name: "Jo", state: "waiting" },
    { name: "Bea", state: "queued" },
    { name: "Tess", state: "expected" },
    { name: "Ram", state: "waiting" },
    { name: "Lia", state: "done" },
    { name: "Nico", state: "queued" },
  ];

  it("shows everyone checked in: free first, then paired games, then on court, in line order", () => {
    expect(waitingList(players, (player) => player.state).map((player) => player.name)).toEqual([
      "Jo",
      "Ram",
      "Bea",
      "Nico",
      "Mika",
    ]);
  });
});

describe("byBracket", () => {
  it("groups the line by bracket, A first, keeping the order and leaving out empty brackets", () => {
    const players = [
      { name: "Jo", level: key("C") },
      { name: "Bea", level: key("A+") },
      { name: "Ram", level: UNRATED_LEVEL.key as string },
      { name: "Nico", level: key("C-") },
      { name: "Mika", level: key("E") },
    ];
    const groups = byBracket(players);
    expect(groups.map((group) => [group.bracket, group.label, group.players.map((p) => p.name)])).toEqual([
      ["A", "Open", ["Bea"]],
      ["C", "Intermediate", ["Jo", "Nico"]],
      ["E", "Beginner", ["Ram", "Mika"]],
    ]);
    expect(levelLabel(players[1].level)).toBe("A+");
  });
});

describe("shortPlace", () => {
  it("shortens numbered courts and waiting games, and keeps typed names", () => {
    expect(shortPlace("Court 12")).toBe("12");
    expect(shortPlace("Waiting 2")).toBe("W2");
    expect(shortPlace("Main Hall")).toBe("Main Hall");
  });
});
