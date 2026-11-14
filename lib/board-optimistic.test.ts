import { describe, expect, it } from "vitest";
import type { BoardData, BoardMatch, BoardPlayer } from "./board-types";
import { optimisticCancel, optimisticFinish, optimisticStart, optimisticStatus } from "./board-optimistic";

const NOW = "2026-11-14T03:00:00.000Z";

function player(id: string, status: BoardPlayer["status"], gamesPlayed = 0): BoardPlayer {
  return {
    sessionPlayerId: id,
    playerId: `p-${id}`,
    nickname: id,
    fullName: null,
    level: "C",
    levelLabel: "C",
    category: "ACTIVE",
    status,
    joinedAt: null,
    queuedAt: null,
    gamesPlayed,
    permanentPartnerId: null,
    permanentPartnerNickname: null,
    priority: false,
    paid: false,
    amountPaid: 0,
    note: null,
    requests: [],
  };
}

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

function board(players: BoardPlayer[], activeMatches: BoardMatch[]): BoardData {
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

const four = ["a", "b", "c", "d"];
const status = (data: BoardData, id: string) =>
  data.players.find((row) => row.sessionPlayerId === id)?.status;

describe("optimistic board updates", () => {
  it("checks a player in and keeps their first arrival time", () => {
    const data = board([player("a", "EXPECTED"), player("b", "EXPECTED")], []);
    const next = optimisticStatus(data, "a", "WAITING", NOW);
    expect(status(next, "a")).toBe("WAITING");
    expect(next.players[0].joinedAt).toBe(NOW);
    expect(status(next, "b")).toBe("EXPECTED");
    expect(data.players[0].status).toBe("EXPECTED"); // input untouched
  });

  it("starts a game: the match goes live and its four are playing", () => {
    const data = board(
      four.map((id) => player(id, "WAITING")),
      [match("m", "SUGGESTED", four)],
    );
    const next = optimisticStart(data, "m", true, NOW);
    expect(next.activeMatches[0]).toMatchObject({ status: "LIVE", free: true, startedAt: NOW });
    expect(four.map((id) => status(next, id))).toEqual(["PLAYING", "PLAYING", "PLAYING", "PLAYING"]);
  });

  it("finishes a game: off the board, back in the queue, one more game each", () => {
    const data = board(
      [...four.map((id) => player(id, "PLAYING", 2)), player("e", "WAITING", 1)],
      [match("m", "LIVE", four)],
    );
    const next = optimisticFinish(data, "m", NOW);
    expect(next.activeMatches).toHaveLength(0);
    expect(next.recentMatches[0]).toMatchObject({ id: "m", status: "COMPLETED", endedAt: NOW });
    expect(next.players.map((row) => [row.status, row.gamesPlayed])).toEqual([
      ["WAITING", 3],
      ["WAITING", 3],
      ["WAITING", 3],
      ["WAITING", 3],
      ["WAITING", 1],
    ]);
  });

  it("does not count a free game", () => {
    const data = board(
      four.map((id) => player(id, "PLAYING", 2)),
      [match("m", "LIVE", four, true)],
    );
    expect(optimisticFinish(data, "m", NOW).players.every((row) => row.gamesPlayed === 2)).toBe(true);
  });

  it("cancels a game and sends anyone on court back to waiting", () => {
    const data = board(
      four.map((id) => player(id, "PLAYING")),
      [match("m", "LIVE", four)],
    );
    const next = optimisticCancel(data, "m");
    expect(next.activeMatches).toHaveLength(0);
    expect(four.every((id) => status(next, id) === "WAITING")).toBe(true);
  });

  it("leaves the board alone for a match it does not know", () => {
    const data = board([player("a", "WAITING")], []);
    expect(optimisticStart(data, "x", false, NOW)).toBe(data);
    expect(optimisticFinish(data, "x", NOW)).toBe(data);
    expect(optimisticCancel(data, "x")).toBe(data);
  });
});
