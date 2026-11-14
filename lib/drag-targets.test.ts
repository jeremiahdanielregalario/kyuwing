import { describe, expect, it } from "vitest";
import { canDropOn, canTapOn, eventPoint, samePick } from "./drag-targets";

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

  it("lets only players coming off a court go back to the queue", () => {
    const queue = { kind: "queue" };
    expect(canDropOn({ kind: "match-player", matchId: "m1" }, queue)).toBe(true);
    expect(canDropOn({ kind: "queue-player", fromDraft: { courtNumber: 1, index: 0 } }, queue)).toBe(true);
    expect(canDropOn({ kind: "queue-player" }, queue)).toBe(false);
    expect(canDropOn({ kind: "match", matchId: "m1" }, queue)).toBe(false);
    expect(canDropOn(undefined, queue)).toBe(false);
  });

  it("has no target when there is none", () => {
    expect(canDropOn({ kind: "match", matchId: "m1" }, undefined)).toBe(false);
  });
});

describe("canTapOn", () => {
  const courts: Record<string, number> = { m1: 1, q1: 0, q2: 0 };
  const courtOf = (id: string) => courts[id];

  it("highlights nothing until something is picked", () => {
    expect(canTapOn(null, { kind: "court", courtNumber: 2 }, courtOf)).toBe(false);
  });

  it("does not offer a player their own box", () => {
    const picked = { kind: "match-player", matchId: "m1", playerId: "p1" };
    expect(canTapOn(picked, { kind: "slot", matchId: "m1", playerId: "p1" }, courtOf)).toBe(false);
    expect(canTapOn(picked, { kind: "slot", matchId: "m1", playerId: "p2" }, courtOf)).toBe(true);
  });

  it("lets someone still on court go only into a waiting game", () => {
    const picked = { kind: "queue-player", playerId: "p1", status: "PLAYING" };
    expect(canTapOn(picked, { kind: "slot", matchId: "m1", playerId: "p2" }, courtOf)).toBe(false);
    expect(canTapOn(picked, { kind: "slot", matchId: "q1", playerId: "p2" }, courtOf)).toBe(true);
    expect(canTapOn(picked, { kind: "draft-slot", courtNumber: 2 }, courtOf)).toBe(false);
    expect(canTapOn(picked, { kind: "draft-slot", courtNumber: 0 }, courtOf)).toBe(true);
  });

  it("moves a court game to other courts, and a waiting game also within the line", () => {
    const onCourt = { kind: "match", matchId: "m1", courtNumber: 1 };
    expect(canTapOn(onCourt, { kind: "court", courtNumber: 2 }, courtOf)).toBe(true);
    expect(canTapOn(onCourt, { kind: "court", courtNumber: 0, matchId: "q1" }, courtOf)).toBe(false);
    const waiting = { kind: "match", matchId: "q1", courtNumber: 0 };
    expect(canTapOn(waiting, { kind: "court", courtNumber: 0, matchId: "q2" }, courtOf)).toBe(true);
    expect(canTapOn(waiting, { kind: "court", courtNumber: 0, matchId: "q1" }, courtOf)).toBe(false);
  });

  it("only offers a waiting game free courts and other waiting games", () => {
    const waiting = { kind: "match", matchId: "q1", courtNumber: 0 };
    expect(canTapOn(waiting, { kind: "court", courtNumber: 2 }, courtOf)).toBe(true);
    expect(canTapOn(waiting, { kind: "court", courtNumber: 1, matchId: "m1" }, courtOf)).toBe(false);
    expect(canTapOn(waiting, { kind: "court", courtNumber: 0 }, courtOf)).toBe(false);
    const onCourt = { kind: "match", matchId: "m1", courtNumber: 1 };
    expect(canTapOn(onCourt, { kind: "court", courtNumber: 0 }, courtOf)).toBe(false);
  });
});

describe("samePick", () => {
  it("matches the same game or the same player in the same place", () => {
    expect(samePick({ kind: "match", matchId: "a" }, { kind: "match", matchId: "a" })).toBe(true);
    expect(samePick({ kind: "queue-player", playerId: "p" }, { kind: "queue-player", playerId: "p" })).toBe(
      true,
    );
    expect(
      samePick(
        { kind: "queue-player", playerId: "p" },
        { kind: "match-player", playerId: "p", matchId: "m" },
      ),
    ).toBe(false);
    expect(samePick(null, { kind: "match", matchId: "a" })).toBe(false);
  });
});

describe("eventPoint", () => {
  it("reads mouse and touch positions", () => {
    expect(eventPoint({ clientX: 10, clientY: 20 } as unknown as Event)).toEqual({
      x: 10,
      y: 20,
      touch: false,
    });
    expect(eventPoint({ touches: [{ clientX: 5, clientY: 6 }] } as unknown as Event)).toEqual({
      x: 5,
      y: 6,
      touch: true,
    });
    expect(
      eventPoint({ touches: [], changedTouches: [{ clientX: 7, clientY: 8 }] } as unknown as Event),
    ).toEqual({
      x: 7,
      y: 8,
      touch: true,
    });
    expect(eventPoint(null)).toBeNull();
  });
});
