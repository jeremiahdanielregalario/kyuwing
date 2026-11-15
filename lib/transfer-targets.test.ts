import { describe, expect, it } from "vitest";
import type { BoardData, BoardMatch } from "./board-types";
import { transferTargets } from "./transfer-targets";

const NOW = "2026-11-14T03:00:00.000Z";

function match(id: string, status: BoardMatch["status"], ids: string[], free = false): BoardMatch {
  const side = (team: number, slice: string[]) =>
    slice.map((sid, index) => ({
      playerId: `p-${sid}`,
      sessionPlayerId: sid,
      nickname: sid,
      level: "C",
      levelLabel: "C",
      team,
      slot: index + 1,
    }));
  return {
    id,
    courtNumber: 1,
    round: 1,
    status,
    free,
    startedAt: status === "LIVE" ? "2026-11-14T02:30:00.000Z" : null,
    endedAt: null,
    changedAt: "2026-11-14T02:00:00.000Z",
    note: null,
    team1: side(1, ids.slice(0, 2)),
    team2: side(2, ids.slice(2, 4)),
  };
}

function board(players: BoardData["players"], activeMatches: BoardMatch[]): BoardData {
  return {
    gameDay: {} as BoardData["gameDay"],
    leaveRequests: [],
    players,
    activeMatches,
    recentMatches: [],
    stats: {} as BoardData["stats"],
    activeSlotIndex: 0,
    serverNow: NOW,
  };
}

describe("Transfer to Court", () => {
  const on = (row: BoardMatch, court: number): BoardMatch => ({ ...row, courtNumber: court });
  const QUEUED = 0;

  it("offers the free courts to waiting games whose players are all off court, oldest first", () => {
    const data = board(
      [],
      [
        on(match("live", "LIVE", ["a", "b", "c", "d"]), 1),
        on(match("w1", "SUGGESTED", ["a", "e", "f", "g"]), QUEUED), // a is still playing on court 1
        on(match("w2", "SUGGESTED", ["h", "i", "j", "k"]), QUEUED),
        on(match("w3", "SUGGESTED", ["l", "m", "n", "o"]), QUEUED),
      ],
    );
    expect([...transferTargets(data, [1, 2, 3], QUEUED)]).toEqual([
      ["w2", 2],
      ["w3", 3],
    ]);
    expect(transferTargets(data, [1], QUEUED).size).toBe(0);
  });
});
