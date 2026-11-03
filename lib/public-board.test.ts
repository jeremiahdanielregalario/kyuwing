import { describe, expect, it } from "vitest";
import type { BoardData, BoardMatch, BoardPlayer, FeeRow } from "./board-types";
import { locatePlayer, toPublicBoard } from "./public-board";
import { liveViewKey, liveViewPath, verifyLiveViewKey } from "./share";

function player(nickname: string, overrides: Partial<BoardPlayer> = {}): BoardPlayer {
  return {
    sessionPlayerId: `sp-${nickname}`,
    playerId: `p-${nickname}`,
    nickname,
    fullName: `SECRET, ${nickname}`,
    level: "C",
    levelLabel: "C",
    category: "ACTIVE",
    status: "WAITING",
    joinedAt: "2026-11-02T02:00:00.000Z",
    queuedAt: "2026-11-02T02:00:00.000Z",
    gamesPlayed: 1,
    permanentPartnerId: null,
    permanentPartnerNickname: null,
    priority: false,
    paid: true,
    amountPaid: 150,
    note: "private note",
    requests: [],
    ...overrides,
  };
}

function match(id: string, courtNumber: number, status: BoardMatch["status"], names: string[]): BoardMatch {
  const row = (nickname: string, index: number) => ({
    playerId: `p-${nickname}`,
    sessionPlayerId: `sp-${nickname}`,
    nickname,
    level: "C",
    levelLabel: "C",
    team: index < 2 ? 1 : 2,
    slot: (index % 2) + 1,
  });
  const rows = names.map(row);
  return {
    id,
    courtNumber,
    round: 1,
    status,
    free: false,
    startedAt: null,
    endedAt: null,
    note: null,
    team1: rows.slice(0, 2),
    team2: rows.slice(2),
  };
}

const onCourt = ["Ana", "Ben", "Cy", "Dee"];
const called = ["Eli", "Fe", "Gab", "Hal"];
const queued = ["Ivy", "Jo", "Kai", "Lu"];

const DATA: BoardData = {
  gameDay: {
    id: "gd1",
    name: "Monday KBC",
    date: "2026-11-02T00:00:00.000Z",
    type: "REGULAR",
    status: "LIVE",
    notes: "internal",
    queueMasterName: "Officer Quinn",
    financeMemberName: "Officer Fay",
    courtRatePerHour: null,
    startedAt: null,
    courtPlan: [
      { id: "a", label: "First", start: "10:00", end: "14:00", courts: 3, courtLabels: ["5", "6", "7"] },
    ],
    venue: { id: "v", name: "Kalayaan Badminton Center", shortName: "KBC" },
  },
  players: [
    ...[...onCourt].map((name) => player(name, { status: "PLAYING" })),
    ...[...called, ...queued].map((name) => player(name)),
    player("Late", { queuedAt: "2026-11-02T03:00:00.000Z" }),
    player("Early", { queuedAt: "2026-11-02T01:00:00.000Z" }),
    player("Vip", { queuedAt: "2026-11-02T03:30:00.000Z", priority: true }),
    player("Soon", { status: "EXPECTED", queuedAt: null }),
    player("Gone", { status: "DONE" }),
  ],
  activeMatches: [
    match("m0", 0, "SUGGESTED", queued),
    match("m1", 1, "LIVE", onCourt),
    match("m2", 2, "SUGGESTED", called),
  ],
  recentMatches: [],
  stats: {
    expected: 1,
    waiting: 11,
    playing: 4,
    done: 1,
    total: 17,
    gamesCompleted: 0,
    courtsTotal: 3,
    courtsBusy: 2,
    courtsOpen: 1,
    averageWaitMinutes: 0,
    longestWaitMinutes: 0,
    totalGamesPlayed: 0,
  },
  activeSlotIndex: 0,
  serverNow: "2026-11-02T04:00:00.000Z",
};

describe("toPublicBoard", () => {
  const board = toPublicBoard(DATA);

  it("never carries private player details", () => {
    const json = JSON.stringify(board);
    for (const secret of [
      "Officer",
      "SECRET",
      "private note",
      "internal",
      "amountPaid",
      "fullName",
      "category",
      "p-Ana",
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  it("names courts by their labels and keeps open courts", () => {
    expect(board.courts.map((court) => court.name)).toEqual(["Court 5", "Court 6", "Court 7"]);
    expect(board.courts[2].match).toBeNull();
    expect(board.nextUp).toHaveLength(1);
    expect(board.nextUp[0].court).toBe("Next up");
  });

  it("lists waiting players by priority, then longest wait, without anyone already in a game", () => {
    expect(board.waiting.map((row) => row.nickname)).toEqual(["Vip", "Early", "Late"]);
  });
});

function feeRow(nickname: string, total: number, amountPaid: number, games = 2): FeeRow {
  return {
    sessionPlayerId: `sp-${nickname}`,
    playerId: `p-${nickname}`,
    nickname,
    level: "C",
    category: "ACTIVE",
    status: "DONE",
    gamesPlayed: games,
    flatFee: 250,
    perGameFee: 50,
    total,
    gripCount: 0,
    otherCharge: 0,
    otherNote: null,
    extras: 0,
    paid: amountPaid >= total,
    amountPaid,
    balance: Math.max(0, total - amountPaid),
    change: Math.max(0, amountPaid - total),
    settled: false,
    paymentMethod: "GCASH",
  };
}

describe("payment list", () => {
  const rows = [
    feeRow("Zed", 350, 350),
    feeRow("Ana", 350, 0),
    feeRow("Bo", 300, 100),
    feeRow("Idle", 0, 0, 0),
  ];
  const completed: BoardData = { ...DATA, gameDay: { ...DATA.gameDay, status: "COMPLETED" } };

  it("is hidden until the game day is completed, even if fee rows are passed", () => {
    expect(toPublicBoard(DATA, rows).fees).toBeNull();
    expect(toPublicBoard(completed).fees).toBeNull();
  });

  it("lists unsettled players first, skips no-fee players, and settled players show a zero balance", () => {
    const fees = toPublicBoard(completed, rows).fees;
    expect(fees?.map((fee) => [fee.nickname, fee.balance])).toEqual([
      ["Ana", 350],
      ["Bo", 200],
      ["Zed", 0],
    ]);
  });

  it("carries only nickname, games, total, and balance", () => {
    const json = JSON.stringify(toPublicBoard(completed, rows));
    for (const secret of [
      "SECRET",
      "fullName",
      "category",
      "amountPaid",
      "paymentMethod",
      "GCASH",
      "p-Ana",
    ]) {
      expect(json).not.toContain(secret);
    }
    expect(toPublicBoard(completed, rows).fees?.[0]).toEqual({
      nickname: "Ana",
      games: 2,
      total: 350,
      balance: 350,
    });
  });
});

describe("locatePlayer", () => {
  const board = toPublicBoard(DATA);

  it("finds players on court, called, and in Next up", () => {
    expect(locatePlayer(board, "ana")).toEqual({ kind: "playing", court: "Court 5" });
    expect(locatePlayer(board, "Fe")).toEqual({ kind: "called", court: "Court 6" });
    expect(locatePlayer(board, " kai ")).toEqual({ kind: "next", position: 1 });
  });

  it("gives waiting players their place in line", () => {
    expect(locatePlayer(board, "Late")).toEqual({ kind: "waiting", position: 3, total: 3 });
  });

  it("explains players who are not in the queue", () => {
    expect(locatePlayer(board, "Soon")).toEqual({ kind: "expected" });
    expect(locatePlayer(board, "Gone")).toEqual({ kind: "done" });
    expect(locatePlayer(board, "Nobody")).toEqual({ kind: "missing" });
  });
});

describe("live view links", () => {
  it("accepts only the key made for that game day", () => {
    const key = liveViewKey("gd1");
    expect(verifyLiveViewKey("gd1", key)).toBe(true);
    expect(verifyLiveViewKey("gd2", key)).toBe(false);
    expect(verifyLiveViewKey("gd1", key.slice(0, -1) + (key.endsWith("A") ? "B" : "A"))).toBe(false);
    expect(verifyLiveViewKey("gd1", "short")).toBe(false);
    expect(liveViewPath("gd1")).toBe(`/live/gd1/${key}`);
  });
});
