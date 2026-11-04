import { describe, expect, it } from "vitest";
import {
  blockingLines,
  parseSignupText,
  resolveSignup,
  removeLine,
  rewriteLine,
  type KnownPlayer,
} from "./signup-text";

const MESSENGER = `Official MEGA Game Day (KBC) 
Nov 2, 2026; Monday
10AM - 3PM

1. QM: Jgops
2. FIN: Dylan
3. @Shawn Elizarde 
4. Randolf
5. Lou
6. @Paolo Adriano
13. @JCB
27. Carl
`;

const PLAYERS: KnownPlayer[] = [
  { nickname: "Jgops", fullName: "REGALARIO, Jeremiah Daniel" },
  { nickname: "Dylan", fullName: "MIRANDA, Dylan Thomas" },
  { nickname: "Shawn", fullName: "ELIZARDE, Shawn" },
  { nickname: "Randolf", fullName: null },
  { nickname: "Lou", fullName: null },
  { nickname: "Paolo", fullName: "ADRIANO, Paolo" },
  { nickname: "JCB", fullName: null },
  { nickname: "Carl", fullName: null },
  { nickname: "Carlos", fullName: null },
];

describe("parseSignupText header", () => {
  const { header } = parseSignupText(MESSENGER);

  it("reads the event title, type and venue", () => {
    expect(header.title).toBe("Official MEGA Game Day (KBC)");
    expect(header.type).toBe("MEGA");
    expect(header.venueShort).toBe("KBC");
  });

  it("reads the date and the time range", () => {
    expect(header.date).toBe("2026-11-02");
    expect(header.start).toBe("10:00");
    expect(header.end).toBe("15:00");
  });

  it("copes with other time styles", () => {
    expect(parseSignupText("Game\nNov 2, 2026\n10:00 AM - 2:30 PM\n1. A").header).toMatchObject({
      start: "10:00",
      end: "14:30",
    });
    expect(parseSignupText("Game\nNov 2, 2026\n10-3PM\n1. A").header).toMatchObject({
      start: "10:00",
      end: "15:00",
    });
    expect(parseSignupText("Game\nNov 2, 2026\n6PM - 9PM\n1. A").header).toMatchObject({
      start: "18:00",
      end: "21:00",
    });
  });

  it("defaults to a regular game day and tolerates a missing date or time", () => {
    const parsed = parseSignupText("Game Day (BKC)\n1. A").header;
    expect(parsed).toMatchObject({ type: "REGULAR", venueShort: "BKC", date: null, start: null });
  });

  it("recognises a Tipid game day, and rejects an impossible date", () => {
    expect(parseSignupText("Tipid Game Day (KBC)\n1. A").header.type).toBe("TIPID");
    expect(parseSignupText("Game\nFeb 31, 2026\n1. A").header.date).toBeNull();
  });
});

describe("parseSignupText lines", () => {
  const { lines } = parseSignupText(MESSENGER);

  it("reads every numbered line, in order, keeping the written numbers", () => {
    expect(lines.map((line) => line.number)).toEqual([1, 2, 3, 4, 5, 6, 13, 27]);
  });

  it("takes QM and FIN labels as roles and strips them from the name", () => {
    expect(lines[0]).toMatchObject({ role: "QM", name: "Jgops" });
    expect(lines[1]).toMatchObject({ role: "FIN", name: "Dylan" });
    expect(lines[2].role).toBeNull();
  });

  it("strips the @ of a mention and trims stray spaces", () => {
    expect(lines[2]).toMatchObject({ name: "Shawn Elizarde", mention: true });
    expect(lines[6]).toMatchObject({ name: "JCB", mention: true });
    expect(lines[3]).toMatchObject({ name: "Randolf", mention: false });
  });

  it("puts lines under a Waitlist heading aside, and reports stray text after the list", () => {
    const parsed = parseSignupText("Game\n1. A\n2. B\nWaitlist:\n1. C\nsee you all!");
    expect(parsed.lines.map((line) => [line.name, line.waitlist])).toEqual([
      ["A", false],
      ["B", false],
      ["C", true],
    ]);
    expect(parsed.ignored).toEqual(["see you all!"]);
  });
});

describe("resolveSignup", () => {
  const resolved = resolveSignup(parseSignupText(MESSENGER).lines, PLAYERS);
  const byName = (name: string) => resolved.find((line) => line.name === name)!;

  it("accepts exact official nicknames, whatever the capitalisation", () => {
    expect(byName("Randolf")).toMatchObject({ status: "ok", nickname: "Randolf" });
    expect(byName("JCB")).toMatchObject({ status: "ok", nickname: "JCB" });
    const lower = resolveSignup(parseSignupText("G\n1. randolf").lines, PLAYERS)[0];
    expect(lower).toMatchObject({ status: "ok", nickname: "Randolf" });
  });

  it("does not accept a full name as an official nickname, but suggests the nickname", () => {
    expect(byName("Shawn Elizarde")).toMatchObject({
      status: "suggest",
      nickname: "Shawn",
      suggestions: ["Shawn"],
    });
    expect(byName("Paolo Adriano")).toMatchObject({ status: "suggest", nickname: "Paolo" });
  });

  it("flags an unknown name and suggests close official nicknames", () => {
    const line = resolveSignup(parseSignupText("G\n1. Carlo").lines, PLAYERS)[0];
    expect(line.status).toBe("unknown");
    expect(line.suggestions).toEqual(expect.arrayContaining(["Carl", "Carlos"]));
  });

  it("flags the same player listed twice", () => {
    const lines = resolveSignup(parseSignupText("G\n1. Lou\n2. lou").lines, PLAYERS);
    expect(lines.map((line) => line.status)).toEqual(["ok", "duplicate"]);
  });

  it("blocks creation while any confirmed line is not an official nickname", () => {
    expect(blockingLines(resolved).map((line) => line.name)).toEqual(["Shawn Elizarde", "Paolo Adriano"]);
    const clean = resolveSignup(parseSignupText("G\n1. QM: Jgops\n2. Lou").lines, PLAYERS);
    expect(blockingLines(clean)).toEqual([]);
  });

  it("does not block on a waitlisted name that is not official", () => {
    const lines = resolveSignup(parseSignupText("G\n1. Lou\nWaitlist:\n1. Nobody").lines, PLAYERS);
    expect(blockingLines(lines)).toEqual([]);
  });
});

describe("rewriteLine", () => {
  it("replaces one line with the nickname, keeping its number and QM/FIN label", () => {
    const text = "Game\n1. QM: Jeremiah Regalario\n2. @Shawn Elizarde\n3. Lou";
    const lines = parseSignupText(text).lines;
    const fixed = rewriteLine(rewriteLine(text, lines[1], "Shawn"), lines[0], "Jgops");
    expect(fixed).toBe("Game\n1. QM: Jgops\n2. Shawn\n3. Lou");
    expect(parseSignupText(fixed).lines.map((line) => line.name)).toEqual(["Jgops", "Shawn", "Lou"]);
  });
});

describe("removeLine", () => {
  it("takes out only that line", () => {
    const text = "Game\n1. Lou\n2. Lou\n3. Carl";
    const lines = parseSignupText(text).lines;
    expect(removeLine(text, lines[1])).toBe("Game\n1. Lou\n3. Carl");
  });
});
