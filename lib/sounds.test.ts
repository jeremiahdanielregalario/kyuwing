import { describe, expect, it } from "vitest";
import { shouldSkipSound } from "./sounds";

describe("shouldSkipSound", () => {
  it("plays the first cue", () => {
    expect(shouldSkipSound("success", null, 1000)).toBe(false);
  });

  it("drops the generic success that follows a start, finish or drop", () => {
    expect(shouldSkipSound("success", { kind: "start", at: 1000 }, 1400)).toBe(true);
    expect(shouldSkipSound("success", { kind: "finish", at: 1000 }, 3000)).toBe(true);
    expect(shouldSkipSound("success", { kind: "drop", at: 1000 }, 4000)).toBe(false);
  });

  it("never swallows an error or an alert", () => {
    expect(shouldSkipSound("error", { kind: "start", at: 1000 }, 1200)).toBe(false);
    expect(shouldSkipSound("alert", { kind: "finish", at: 1000 }, 1200)).toBe(false);
  });

  it("drops the same cue fired twice at once, but not a real repeat", () => {
    expect(shouldSkipSound("alert", { kind: "alert", at: 1000 }, 1050)).toBe(true);
    expect(shouldSkipSound("success", { kind: "success", at: 1000 }, 1500)).toBe(false);
  });
});
