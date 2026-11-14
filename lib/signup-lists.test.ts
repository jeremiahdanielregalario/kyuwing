import { describe, expect, it } from "vitest";
import { nicknameSurnameKeys, parseSignupText, resolveSignup } from "./signup-text";

const APPLICANTS = `Official Game Day (DASC)
Nov 16, 2026; Monday
11AM - 3PM

1. Clyde Abella
2. Matt Dela Cruz
3. M Tandoc
4. Bryce Lunas
5. Clyde
18-43. MEMALUMNS

Waitlist:
1. Ethan Benedict
2.
3. `;

const MEMBERS = `Official Game Day (DASC)
Nov 16, 2026; Monday
11AM - 4PM

1. QM: Roniel
2. FIN: Ivana
3. Ian Benedict De Guzman
4. @Leidovic Keth Gellang
5. Neo b
6. Matt Dela Cruz
38-54. APPS

Waitlist:
1. Wil
2.
3. `;

const PLAYERS = [
  { nickname: "Clyde", fullName: "ABELLA, Clyde Anthony" },
  { nickname: "Matt", fullName: "DELA CRUZ, Matthew" },
  { nickname: "M", fullName: "TANDOC, Maria" },
  { nickname: "Roniel", fullName: "SANTOS, Roniel" },
  { nickname: "Ivana", fullName: "REYES, Ivana" },
  { nickname: "Ian", fullName: "DE GUZMAN, Ian Benedict" },
  { nickname: "Leido", fullName: "GELLANG, Leidovic Keth" },
  { nickname: "Neo", fullName: "BAUTISTA, Neo", aliases: ["Neo B"] },
];

describe("parseSignupText with the two Messenger lists", () => {
  it("skips the places kept for the other list and empty waitlist lines", () => {
    const parsed = parseSignupText(APPLICANTS, "applicants");
    expect(parsed.header).toMatchObject({
      date: "2026-11-16",
      start: "11:00",
      end: "15:00",
      venueShort: "DASC",
    });
    expect(parsed.lines.map((line) => [line.name, line.waitlist, line.list])).toEqual([
      ["Clyde Abella", false, "applicants"],
      ["Matt Dela Cruz", false, "applicants"],
      ["M Tandoc", false, "applicants"],
      ["Bryce Lunas", false, "applicants"],
      ["Clyde", false, "applicants"],
      ["Ethan Benedict", true, "applicants"],
    ]);
    expect(parsed.ignored).toEqual([]);
  });
});

describe("resolveSignup across both lists", () => {
  const lines = resolveSignup(
    [...parseSignupText(MEMBERS, "members").lines, ...parseSignupText(APPLICANTS, "applicants").lines],
    PLAYERS,
  );
  const find = (list: string, name: string) =>
    lines.find((line) => line.list === list && line.name === name)!;

  it("reads an applicant's nickname and surname as the official nickname", () => {
    expect(find("applicants", "Clyde Abella")).toMatchObject({
      status: "ok",
      nickname: "Clyde",
      viaSurname: true,
    });
    expect(find("applicants", "M Tandoc")).toMatchObject({ status: "ok", nickname: "M" });
    expect(find("applicants", "Bryce Lunas")).toMatchObject({ status: "unknown", nickname: null });
  });

  it("flags someone on both lists, and the same person twice on one", () => {
    // Matt is first on the members list, so his applicants line is the repeat.
    expect(find("members", "Matt Dela Cruz")).toMatchObject({ status: "suggest", nickname: "Matt" });
    expect(find("applicants", "Matt Dela Cruz")).toMatchObject({ status: "ok", nickname: "Matt" });
    expect(find("applicants", "Clyde")).toMatchObject({ status: "duplicate", nickname: "Clyde" });
  });

  it("keeps the members list strict: full names and mentions need fixing, other names pass", () => {
    expect(find("members", "Ian Benedict De Guzman")).toMatchObject({
      status: "suggest",
      suggestions: ["Ian"],
    });
    expect(find("members", "Leidovic Keth Gellang")).toMatchObject({ status: "suggest", mention: true });
    expect(find("members", "Neo b")).toMatchObject({ status: "ok", nickname: "Neo", viaAlias: true });
    expect(find("members", "Roniel")).toMatchObject({ status: "ok", role: "QM" });
  });
});

describe("nicknameSurnameKeys", () => {
  it("uses the part before the comma, or the last words without one", () => {
    expect(nicknameSurnameKeys("Matt", "DELA CRUZ, Matthew")).toEqual(["matt dela cruz"]);
    expect(nicknameSurnameKeys("Matt", "Matthew Dela Cruz")).toEqual(["matt cruz", "matt dela cruz"]);
    expect(nicknameSurnameKeys("Matt", null)).toEqual([]);
  });
});
