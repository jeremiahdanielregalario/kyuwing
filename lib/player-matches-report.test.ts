import { describe, expect, it } from "vitest";
import type { BoardMatch, BoardMatchPlayer, FeeReport, FeeRow } from "@/lib/board-types";
import { playerMatchesReport } from "@/lib/player-matches-report";

function p(id: string, team: number, level = "C"): BoardMatchPlayer {
  return { playerId: `pl-${id}`, sessionPlayerId: id, nickname: id, level, levelLabel: level, team, slot: 0 };
}

function match(
  id: string,
  start: string,
  t1: [string, string],
  t2: [string, string],
  extra: Partial<BoardMatch> = {},
) {
  return {
    id,
    courtNumber: 1,
    round: 1,
    status: "COMPLETED",
    free: false,
    startedAt: `2026-11-21T${start}:00.000Z`,
    endedAt: `2026-11-21T${start}:15.000Z`,
    changedAt: `2026-11-21T${start}:00.000Z`,
    note: null,
    team1: t1.map((x) => p(x, 1)),
    team2: t2.map((x) => p(x, 2)),
    ...extra,
  } as BoardMatch;
}

function row(id: string, status = "DONE", gamesPlayed = 0): FeeRow {
  return { sessionPlayerId: id, nickname: id, level: "C", status, gamesPlayed } as FeeRow;
}

function report(rows: FeeRow[], matches: BoardMatch[]): FeeReport {
  return { rows, matches } as FeeReport;
}

describe("playerMatchesReport", () => {
  it("lists each player's games oldest first, with partner and opponents", () => {
    const blocks = playerMatchesReport(
      report(
        [row("Cid", "DONE", 2), row("Ana", "DONE", 2), row("Ben"), row("Dee"), row("Eve")],
        // Newest first, as the report holds them.
        [
          match("m2", "11:00", ["Ana", "Eve"], ["Cid", "Ben"], { round: 2, courtNumber: 3 }),
          match("m1", "10:00", ["Ana", "Ben"], ["Cid", "Dee"]),
        ],
      ),
    );
    expect(blocks.map((block) => block.nickname)).toEqual(["Ana", "Ben", "Cid", "Dee", "Eve"]);
    const ana = blocks[0];
    expect(ana.levelLabel).toBe("C");
    expect(ana.lines).toEqual([
      expect.objectContaining({ number: 1, round: 1, partner: "Ben (C)", opponents: "Cid (C) & Dee (C)" }),
      expect.objectContaining({
        number: 2,
        round: 2,
        courtNumber: 3,
        partner: "Eve (C)",
        opponents: "Cid (C) & Ben (C)",
      }),
    ]);
    expect(blocks[2].lines.map((line) => line.partner)).toEqual(["Dee (C)", "Ben (C)"]);
  });

  it("lists free games, flagged, and leaves out unfinished ones", () => {
    const blocks = playerMatchesReport(
      report(
        [row("Ana", "DONE", 0), row("Ben"), row("Cid"), row("Dee")],
        [
          match("free", "10:00", ["Ana", "Ben"], ["Cid", "Dee"], { free: true }),
          match("live", "11:00", ["Ana", "Ben"], ["Cid", "Dee"], { status: "LIVE" }),
        ],
      ),
    );
    expect(blocks[0].lines).toHaveLength(1);
    expect(blocks[0].lines[0].free).toBe(true);
    expect(blocks[0].gamesPlayed).toBe(0);
  });

  it("keeps checked-in players with no games and drops expected ones who never came", () => {
    const blocks = playerMatchesReport(report([row("Ana", "WAITING"), row("Ben", "EXPECTED")], []));
    expect(blocks.map((block) => [block.nickname, block.lines.length])).toEqual([["Ana", 0]]);
  });
});
