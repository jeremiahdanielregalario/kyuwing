import { describe, expect, it } from "vitest";
import { aliasConflict, aliasIndex, cleanAliases, learnedAliases, parseAliases } from "./aliases";
import { isQueueMasterOnDuty } from "./fees";
import { parseSignupText, resolveSignup } from "./signup-text";

const PLAYERS = [
  { nickname: "Ian LA", fullName: null, aliases: ["LA"] },
  { nickname: "XB", fullName: null, aliases: ["Chris"] },
  { nickname: "Neo", fullName: null, aliases: ["Neo B"] },
  { nickname: "Neo G", fullName: null, aliases: [] },
  { nickname: "Ian", fullName: null, aliases: ["Ian qt"] },
  { nickname: "Annie", fullName: null, aliases: ["Marian"] },
  { nickname: "Jgops", fullName: null, aliases: ["J"] },
];

describe("parseAliases and cleanAliases", () => {
  it("splits on commas and new lines, trims, and drops repeats and the nickname", () => {
    expect(parseAliases(" LA ,  Ian  L.A.\n\n")).toEqual(["LA", "Ian L.A."]);
    expect(cleanAliases("Ian LA", ["LA", "la", "ian la", " Ian  qt "])).toEqual(["LA", "Ian qt"]);
  });
});

describe("aliasConflict", () => {
  const others = [
    { nickname: "Neo G", aliases: [] },
    { nickname: "XB", aliases: ["Chris"] },
  ];
  it("flags an alias that is another player's nickname or other name", () => {
    expect(aliasConflict(["neo g"], others)).toEqual({ alias: "neo g", owner: "Neo G", asNickname: true });
    expect(aliasConflict(["CHRIS"], others)).toEqual({ alias: "CHRIS", owner: "XB", asNickname: false });
    expect(aliasConflict(["Neo B"], others)).toBeNull();
  });
});

describe("aliasIndex", () => {
  it("matches nobody on an alias two players share", () => {
    const index = aliasIndex([
      { aliases: ["Kim"], value: "a" },
      { aliases: ["kim", "Bo"], value: "b" },
    ]);
    expect(index.has("kim")).toBe(false);
    expect(index.get("bo")).toBe("b");
  });
});

describe("resolveSignup with other names", () => {
  it("reads each other name as the official nickname, with no fixing needed", () => {
    const text = "Game day\n1. QM: J\n2. LA\n3. Chris\n4. Neo b\n5. Ian qt\n6. Marian\n7. Neo G";
    const lines = resolveSignup(parseSignupText(text).lines, PLAYERS);
    expect(lines.map((line) => [line.status, line.nickname, line.viaAlias])).toEqual([
      ["ok", "Jgops", true],
      ["ok", "Ian LA", true],
      ["ok", "XB", true],
      ["ok", "Neo", true],
      ["ok", "Ian", true],
      ["ok", "Annie", true],
      ["ok", "Neo G", false],
    ]);
  });

  it("flags the same player listed under the nickname and an other name", () => {
    const lines = resolveSignup(parseSignupText("G\n1. XB\n2. Chris").lines, PLAYERS);
    expect(lines[1]).toMatchObject({ status: "duplicate", nickname: "XB" });
  });
});

describe("isQueueMasterOnDuty with other names", () => {
  it("matches a queue master stored under one of their other names", () => {
    expect(isQueueMasterOnDuty("Jgops", "Roniel & J", ["J"])).toBe(true);
    expect(isQueueMasterOnDuty("Jgops", "Roniel & J")).toBe(false);
  });
});

describe("learnedAliases", () => {
  const players = [
    { nickname: "Ian", aliases: ["Ian qt"] },
    { nickname: "Leido", aliases: [] },
    { nickname: "XB", aliases: ["Chris"] },
  ];

  it("saves the written name as the picked player's other name", () => {
    const { updates, saved, skipped } = learnedAliases(
      [
        { name: "Ian Benedict De Guzman", nickname: "Ian" },
        { name: "@Leidovic  Keth Gellang", nickname: "Leido" },
      ],
      players,
    );
    expect(updates.get("Ian")).toEqual(["Ian qt", "Ian Benedict De Guzman"]);
    expect(updates.get("Leido")).toEqual(["Leidovic Keth Gellang"]);
    expect(saved).toHaveLength(2);
    expect(skipped).toEqual([]);
  });

  it("skips names it already knows and names that belong to someone else", () => {
    const { updates, skipped } = learnedAliases(
      [
        { name: "ian QT", nickname: "Ian" },
        { name: "Chris", nickname: "Leido" },
        { name: "XB", nickname: "Ian" },
      ],
      players,
    );
    expect(updates.size).toBe(0);
    expect(skipped.map((pick) => pick.reason)).toEqual(["already used by XB", "already used by XB"]);
  });

  it("does not let one batch give the same name to two players", () => {
    const { updates, skipped } = learnedAliases(
      [
        { name: "Kuya", nickname: "Ian" },
        { name: "Kuya", nickname: "Leido" },
      ],
      players,
    );
    expect(updates.get("Ian")).toEqual(["Ian qt", "Kuya"]);
    expect(updates.has("Leido")).toBe(false);
    expect(skipped[0].reason).toBe("already used by Ian");
  });
});
