import { describe, expect, it } from "vitest";
import { notReadyReason, type SignupCheck } from "./signup-check";
import { parseSignupText, resolveSignup } from "./signup-text";

const PLAYERS = [
  { nickname: "Shawn", fullName: "ELIZARDE, Shawn" },
  { nickname: "Lou", fullName: null },
  { nickname: "Carl", fullName: null },
];

function checkFor(text: string): SignupCheck {
  const lines = resolveSignup(parseSignupText(text).lines, PLAYERS);
  const blocking = lines.filter((line) => !line.waitlist && line.status !== "ok").length;
  return {
    header: {
      title: null,
      type: "REGULAR",
      venueShort: null,
      date: null,
      start: null,
      end: null,
      venueId: null,
      venueName: null,
    },
    lines,
    ignored: [],
    blocking,
    ready: lines.length > 0 && blocking === 0,
    alreadyOnList: [],
    inactive: [],
  };
}

describe("notReadyReason", () => {
  it("tells the queue master which nickname to use for a full name", () => {
    expect(notReadyReason(checkFor("G\n1. Lou\n2. @Shawn Elizarde"))).toContain(
      'Shawn Elizarde (use "Shawn")',
    );
  });

  it("names a name that is not official, and a duplicate", () => {
    const reason = notReadyReason(checkFor("G\n1. Lou\n2. Lou\n3. Zorro"));
    expect(reason).toContain("Lou (listed twice)");
    expect(reason).toContain("Zorro (not an official nickname)");
  });

  it("says when there is nothing to add", () => {
    expect(notReadyReason(checkFor("Just a title"))).toContain("No numbered player lines");
  });

  it("caps a long list of problems", () => {
    const text = "G\n" + Array.from({ length: 7 }, (_, index) => `${index + 1}. Nobody${index}`).join("\n");
    expect(notReadyReason(checkFor(text))).toContain("and 3 more");
  });
});
