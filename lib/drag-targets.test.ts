import { describe, expect, it } from "vitest";
import { canDropOn } from "./drag-targets";

const court = { kind: "court" };
const courtWithGame = (matchId: string) => ({ kind: "court", matchId });
const slot = { kind: "slot", matchId: "m1" };
const draft = { kind: "draft-slot" };

describe("canDropOn", () => {
  it("never lets a court card land in a player's box", () => {
    const dragging = { kind: "match", matchId: "m1" };
    expect(canDropOn(dragging, slot)).toBe(false);
    expect(canDropOn(dragging, draft)).toBe(false);
  });

  it("lets a court card go onto another court or waiting game, but not onto itself", () => {
    const dragging = { kind: "match", matchId: "m1" };
    expect(canDropOn(dragging, court)).toBe(true);
    expect(canDropOn(dragging, courtWithGame("m2"))).toBe(true);
    expect(canDropOn(dragging, courtWithGame("m1"))).toBe(false);
  });

  it("lets a player from the queue go onto player boxes, empty slots and empty courts only", () => {
    const dragging = { kind: "queue-player" };
    expect(canDropOn(dragging, slot)).toBe(true);
    expect(canDropOn(dragging, draft)).toBe(true);
    expect(canDropOn(dragging, court)).toBe(true);
    expect(canDropOn(dragging, courtWithGame("m2"))).toBe(false);
  });

  it("lets a player in a game go only onto player boxes", () => {
    const dragging = { kind: "match-player" };
    expect(canDropOn(dragging, slot)).toBe(true);
    expect(canDropOn(dragging, court)).toBe(false);
    expect(canDropOn(dragging, draft)).toBe(false);
  });

  it("has no target when there is none", () => {
    expect(canDropOn({ kind: "match", matchId: "m1" }, undefined)).toBe(false);
  });
});
