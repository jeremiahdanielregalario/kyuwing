import { describe, expect, it } from "vitest";
import { isTrimId, sanitizeHidden, TRIM_TARGETS, trimLabel } from "./ui-trim";

describe("trim registry", () => {
  it("has unique, well-formed ids", () => {
    const ids = TRIM_TARGETS.map((target) => target.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const target of TRIM_TARGETS) {
      expect(target.id).toMatch(/^[a-z0-9.-]+$/);
      expect(target.group.length).toBeGreaterThan(0);
      expect(target.label.length).toBeGreaterThan(0);
    }
  });

  it("only accepts registered ids", () => {
    expect(isTrimId("board.drag-hint")).toBe(true);
    expect(isTrimId("board.check-in-button")).toBe(false);
    expect(isTrimId(42)).toBe(false);
  });

  it("drops unknown, duplicate, and non-string entries", () => {
    const hidden = sanitizeHidden([
      "board.recent",
      "board.recent",
      "not-a-real-target",
      7,
      null,
      "guide.faq",
    ]);
    expect(hidden).toEqual(["board.recent", "guide.faq"]);
    expect(sanitizeHidden(null)).toEqual([]);
    expect(sanitizeHidden("board.recent")).toEqual([]);
  });

  it("falls back to the raw id when a label is missing", () => {
    expect(trimLabel("board.recent")).toBe("Recently finished panel");
    expect(trimLabel("missing.target")).toBe("missing.target");
  });
});
