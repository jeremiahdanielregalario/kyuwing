import { describe, expect, it } from "vitest";
import { sameBoard } from "./board-compare";

describe("sameBoard", () => {
  const board = { serverNow: "2026-11-15T10:00:00.000Z", players: [{ id: "a", status: "WAITING" }] };

  it("treats snapshots that differ only in the server time as the same", () => {
    expect(sameBoard(board, { ...board, serverNow: "2026-11-15T10:00:05.000Z" })).toBe(true);
  });

  it("notices a real change", () => {
    expect(sameBoard(board, { ...board, players: [{ id: "a", status: "PLAYING" }] })).toBe(false);
  });

  it("handles a missing snapshot", () => {
    expect(sameBoard(undefined, board)).toBe(false);
    expect(sameBoard(undefined, undefined)).toBe(true);
  });
});
