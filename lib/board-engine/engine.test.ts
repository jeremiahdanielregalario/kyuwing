import { describe, expect, it } from "vitest";
import { canonicalJson, normalizeState } from "./canonical";
import { diffStates, isEmptyChange } from "./diff";
import { applyOp, applyOps, type BoardOp, type BoardOpBody } from "./ops";
import { blankSignup } from "./players";
import type { EngineState } from "./types";
import { toBoardData, toFeeReport } from "./view";

// 2026-11-14 is a Saturday; the plan runs 8:00 to 12:00 Manila (00:00 to 04:00 UTC).
const DAY = Date.UTC(2026, 10, 14);
const AT_9 = DAY + 1 * 3_600_000; // 9:00 Manila
const LEVELS = ["C", "C", "C+", "C-", "B-", "B", "C", "C", "D+", "D"];

function fixture(players = 10): EngineState {
  return {
    gameDay: {
      id: "gd1",
      name: "Saturday",
      date: new Date(DAY).toISOString(),
      type: "REGULAR",
      status: "LIVE",
      courtPlan: [{ id: "s1", label: "Morning", start: "08:00", end: "12:00", courts: 2 }],
      notes: null,
      queueMasterName: "P0",
      financeMemberName: null,
      courtRatePerHour: 300,
      courtHoursOverride: null,
      startedAt: DAY,
      completedAt: null,
      venue: { id: "v1", name: "DASC", shortName: "DASC" },
    },
    players: Array.from({ length: players }, (_, index) =>
      blankSignup(`sp${index}`, {
        playerId: `p${index}`,
        nickname: `P${index}`,
        fullName: null,
        level: LEVELS[index % LEVELS.length].replace("+", "_PLUS").replace("-", "_MINUS"),
        category: "ACTIVE",
        aliases: [],
      }),
    ),
    matches: [],
    leaveRequests: [],
    requests: [],
  };
}

let counter = 0;
function op(body: BoardOpBody, at = AT_9): BoardOp {
  counter += 1;
  return { id: `op-${counter.toString().padStart(4, "0")}`, at, ...body } as BoardOp;
}

function checkInAll(state: EngineState, count = state.players.length): EngineState {
  return applyOps(
    state,
    state.players
      .slice(0, count)
      .map((row) => op({ type: "checkIn", sessionPlayerId: row.id }, AT_9 - 60_000)),
  );
}

describe("board engine", () => {
  it("checks players in without changing the state it was given", () => {
    const start = fixture();
    const { state, result } = applyOp(start, op({ type: "checkIn", sessionPlayerId: "sp0" }));
    expect(result).toEqual({ ok: true, message: "P0 is in the queue.", data: undefined });
    expect(state.players[0].status).toBe("WAITING");
    expect(state.players[0].joinedAt).toBe(AT_9);
    expect(start.players[0].status).toBe("EXPECTED");
  });

  it("returns the same state when an operation is refused", () => {
    const start = fixture();
    const { state, result } = applyOp(start, op({ type: "checkIn", sessionPlayerId: "nope" }));
    expect(result.ok).toBe(false);
    expect(state).toBe(start);
  });

  it("auto-pairs open courts with deterministic ids, and applying the same press twice adds nothing", () => {
    const ready = checkInAll(fixture(8));
    const press = op({ type: "generate" });
    const once = applyOp(ready, press);
    expect(once.result.ok).toBe(true);
    const suggested = once.state.matches.filter((match) => match.status === "SUGGESTED");
    expect(suggested.map((match) => match.id).sort()).toEqual([`${press.id}-0`, `${press.id}-1`]);
    expect(suggested.map((match) => match.courtNumber).sort()).toEqual([1, 2]);
    const ids = suggested.flatMap((match) => match.players.map((row) => row.playerId));
    expect(new Set(ids).size).toBe(8);

    const twice = applyOp(once.state, press);
    expect(twice.state.matches).toHaveLength(2);
  });

  it("gives the same answer on the tablet and the server for the same presses", () => {
    const ready = checkInAll(fixture(10));
    const presses = [op({ type: "generate" })];
    const tablet = applyOps(ready, presses);
    const server = applyOps(structuredClone(ready), presses);
    expect(canonicalJson(normalizeState(tablet))).toBe(canonicalJson(normalizeState(server)));
  });

  it("starts, finishes and restores a game, counting games played", () => {
    let state = checkInAll(fixture(8));
    state = applyOp(state, op({ type: "generate" })).state;
    const match = state.matches[0];
    const started = applyOp(state, op({ type: "startMatch", matchId: match.id }));
    expect(started.result.ok).toBe(true);
    state = started.state;
    const onCourt = match.players.map((row) => row.playerId);
    expect(
      state.players.filter((row) => onCourt.includes(row.playerId)).every((row) => row.status === "PLAYING"),
    ).toBe(true);

    state = applyOp(state, op({ type: "completeMatch", matchId: match.id }, AT_9 + 20 * 60_000)).state;
    const after = state.players.filter((row) => onCourt.includes(row.playerId));
    expect(after.every((row) => row.status === "WAITING" && row.gamesPlayed === 1)).toBe(true);

    state = applyOp(state, op({ type: "restoreMatch", matchId: match.id })).state;
    expect(state.matches.find((row) => row.id === match.id)?.status).toBe("LIVE");
    expect(
      state.players.filter((row) => onCourt.includes(row.playerId)).every((row) => row.gamesPlayed === 0),
    ).toBe(true);
  });

  it("won't pull a player from another court into a line-up", () => {
    let state = checkInAll(fixture(8));
    state = applyOp(state, op({ type: "generate" })).state;
    const [a, b] = state.matches;
    state = applyOp(state, op({ type: "startMatch", matchId: a.id })).state;
    const { result } = applyOp(
      state,
      op({
        type: "updateLineup",
        matchId: b.id,
        team1: [a.players[0].playerId, b.players[1].playerId],
        team2: [b.players[2].playerId, b.players[3].playerId],
      }),
    );
    expect(result.ok).toBe(false);
    expect(applyOp(state, op({ type: "startMatch", matchId: b.id })).result.ok).toBe(true);
  });

  it("creates walk-ins with ids derived from the press, reusing a known nickname", () => {
    const state = {
      ...fixture(4),
      roster: [
        {
          id: "p-known",
          nickname: "Known",
          fullName: null,
          level: "C",
          category: "ACTIVE" as const,
          aliases: [],
          active: true,
        },
      ],
    };
    const known = applyOp(
      state,
      op({ type: "addWalkIn", input: { nickname: "Known", level: "D", category: "ACTIVE" } }),
    );
    expect(known.result.ok).toBe(true);
    const row = known.state.players.at(-1)!;
    expect(row.playerId).toBe("p-known");
    expect(row.newPlayer).toBeUndefined();

    const press = op({ type: "addWalkIn", input: { nickname: "Fresh", level: "D", category: "APPLICANT" } });
    const fresh = applyOp(state, press);
    const added = fresh.state.players.at(-1)!;
    expect(added.id).toBe(`${press.id}-s`);
    expect(added.playerId).toBe(`${press.id}-p`);
    expect(added.newPlayer).toBe(true);
    expect(applyOp(fresh.state, press).state.players).toHaveLength(fresh.state.players.length);
  });

  it("sets priority to a value, so a resend is harmless", () => {
    const press = op({ type: "setPriority", sessionPlayerId: "sp1", priority: true });
    const once = applyOp(fixture(), press).state;
    const twice = applyOp(once, press).state;
    expect(twice.players[1].priority).toBe(true);
  });

  it("closes the game day, cancelling active games", () => {
    let state = checkInAll(fixture(8));
    state = applyOp(state, op({ type: "generate" })).state;
    const { state: closed, result } = applyOp(state, op({ type: "endGameDay", countLiveGames: true }));
    expect(result.ok && result.message).toContain("8 players logged in attendance.");
    expect(closed.gameDay.status).toBe("COMPLETED");
    expect(closed.matches.every((match) => match.status === "CANCELLED")).toBe(true);
    expect(closed.players.every((row) => row.status === "DONE")).toBe(true);
  });

  it("records payments with change due", () => {
    const state = checkInAll(fixture(4));
    const fee = toFeeReport(state, AT_9).rows.find((row) => row.sessionPlayerId === "sp1")!;
    const { state: paid, result } = applyOp(
      state,
      op({ type: "setPayment", sessionPlayerId: "sp1", input: { paid: true, amountPaid: fee.total + 50 } }),
    );
    expect(result.ok && result.message).toContain("Give back");
    const row = paid.players.find((item) => item.id === "sp1")!;
    expect(row.paid).toBe(true);
    expect(row.settled).toBe(false);
  });
});

describe("diffStates", () => {
  it("is empty for no change", () => {
    const state = fixture();
    expect(isEmptyChange(diffStates(state, structuredClone(state)))).toBe(true);
  });

  it("lists created matches, changed sign-ups and new players", () => {
    const ready = checkInAll(fixture(8));
    const withWalkIn = applyOp(
      { ...ready, roster: [] },
      op({ type: "addWalkIn", input: { nickname: "New", level: "C", category: "ACTIVE" } }),
    ).state;
    const paired = applyOp(withWalkIn, op({ type: "generate" })).state;
    const change = diffStates(ready, paired);
    expect(change.createdMatches).toHaveLength(2);
    expect(change.newPlayers.map((row) => row.nickname)).toEqual(["New"]);
    expect(change.createdSignups).toHaveLength(1);
    expect(change.gameDay).toBeNull();
  });

  it("replaces a line-up only when it changed", () => {
    let state = checkInAll(fixture(8));
    state = applyOp(state, op({ type: "generate" })).state;
    const [a, b] = state.matches;
    const swapped = applyOp(
      state,
      op({
        type: "swapPlayers",
        matchIdA: a.id,
        playerIdA: a.players[0].playerId,
        matchIdB: b.id,
        playerIdB: b.players[0].playerId,
      }),
    ).state;
    const change = diffStates(state, swapped);
    expect(change.updatedMatches).toHaveLength(2);
    expect(change.updatedMatches.every((row) => row.players !== null)).toBe(true);

    const moved = applyOp(
      state,
      op({ type: "moveToCourt", matchId: a.id, courtNumber: b.courtNumber }),
    ).state;
    expect(diffStates(state, moved).updatedMatches.every((row) => row.players === null)).toBe(true);
  });

  it("notices level changes", () => {
    const state = fixture();
    state.players[0].level = "X";
    const rated = applyOp(state, op({ type: "setLevels", levels: [{ playerId: "p0", level: "C" }] })).state;
    expect(diffStates(state, rated).levels).toEqual([{ playerId: "p0", level: "C" }]);
  });
});

describe("canonical state", () => {
  it("ignores list order and key order", () => {
    const state = checkInAll(fixture(6));
    const shuffled = { ...structuredClone(state), players: [...state.players].reverse() };
    expect(canonicalJson(normalizeState(shuffled))).toBe(canonicalJson(normalizeState(state)));
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe('{"a":[2,{"d":1}],"b":1}');
  });
});

describe("toBoardData", () => {
  it("draws the board the client expects", () => {
    let state = checkInAll(fixture(10));
    state = applyOp(state, op({ type: "generate" })).state;
    const board = toBoardData(state, { now: AT_9 });
    expect(board.stats.courtsTotal).toBe(2);
    expect(board.stats.courtsBusy).toBe(2);
    expect(board.stats.waiting).toBe(10);
    expect(board.activeMatches.map((match) => match.courtNumber)).toEqual([1, 2]);
    expect(board.activeMatches[0].team1).toHaveLength(2);
    expect(board.players.map((row) => row.nickname)).toEqual(
      [...board.players.map((row) => row.nickname)].sort(),
    );
    expect(board.serverNow).toBe(new Date(AT_9).toISOString());
  });
});
