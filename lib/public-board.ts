/**
 * The view-only board players see from a shared link.
 *
 * Built from the queue master's BoardData but carries only what players need
 * to know where they stand: nicknames, levels, courts, the Next up line, and
 * the waiting order. No full names, contacts, categories, fees, payments,
 * notes, or requests. Pure, so it can be unit-tested.
 */
import type { BoardData, BoardMatch } from "./board-types";
import { courtName, QUEUED_COURT } from "./datetime";

export type PublicPlayer = { nickname: string; levelLabel: string };

export type PublicMatch = {
  id: string;
  court: string;
  status: "SUGGESTED" | "LIVE";
  free: boolean;
  startedAt: string | null;
  team1: PublicPlayer[];
  team2: PublicPlayer[];
};

export type PublicWaiting = PublicPlayer & {
  waitingSince: string | null;
  gamesPlayed: number;
  priority: boolean;
};

export type PublicBoard = {
  gameDay: {
    name: string;
    date: string;
    venue: string;
    status: "DRAFT" | "LIVE" | "COMPLETED";
    block: string | null;
  };
  courts: Array<{ name: string; match: PublicMatch | null }>;
  nextUp: PublicMatch[];
  waiting: PublicWaiting[];
  /** Everyone signed up, for "find me". */
  roster: Array<{ nickname: string; status: "EXPECTED" | "WAITING" | "PLAYING" | "DONE" }>;
  serverNow: string;
};

export function toPublicBoard(data: BoardData): PublicBoard {
  const slot = data.gameDay.courtPlan[data.activeSlotIndex] ?? data.gameDay.courtPlan[0];
  const toMatch = (match: BoardMatch): PublicMatch => ({
    id: match.id,
    court: courtName(slot, match.courtNumber),
    status: match.status === "LIVE" ? "LIVE" : "SUGGESTED",
    free: match.free,
    startedAt: match.startedAt,
    team1: match.team1.map((player) => ({ nickname: player.nickname, levelLabel: player.levelLabel })),
    team2: match.team2.map((player) => ({ nickname: player.nickname, levelLabel: player.levelLabel })),
  });

  const courtCount = Math.max(
    data.stats.courtsTotal,
    ...data.activeMatches.map((match) => match.courtNumber),
  );
  const courts = Array.from({ length: courtCount }, (_, index) => {
    const match = data.activeMatches.find((item) => item.courtNumber === index + 1);
    return { name: courtName(slot, index + 1), match: match ? toMatch(match) : null };
  });

  // Players already in a game (on court, called, or in Next up) are shown there, not in the waiting list.
  const committed = new Set(
    data.activeMatches.flatMap((match) => [...match.team1, ...match.team2].map((player) => player.playerId)),
  );
  const waiting = data.players
    .filter((player) => player.status === "WAITING" && !committed.has(player.playerId))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      const aq = a.queuedAt ? Date.parse(a.queuedAt) : Number.MAX_SAFE_INTEGER;
      const bq = b.queuedAt ? Date.parse(b.queuedAt) : Number.MAX_SAFE_INTEGER;
      return aq - bq || a.nickname.localeCompare(b.nickname);
    })
    .map((player) => ({
      nickname: player.nickname,
      levelLabel: player.levelLabel,
      waitingSince: player.queuedAt ?? player.joinedAt,
      gamesPlayed: player.gamesPlayed,
      priority: player.priority,
    }));

  return {
    gameDay: {
      name: data.gameDay.name,
      date: data.gameDay.date,
      venue: data.gameDay.venue.name,
      status: data.gameDay.status,
      block: slot ? `${slot.start}–${slot.end}` : null,
    },
    courts,
    nextUp: data.activeMatches.filter((match) => match.courtNumber === QUEUED_COURT).map(toMatch),
    waiting,
    roster: data.players.map((player) => ({ nickname: player.nickname, status: player.status })),
    serverNow: data.serverNow,
  };
}

export type PlayerLocation =
  | { kind: "playing"; court: string }
  | { kind: "called"; court: string }
  | { kind: "next"; position: number }
  | { kind: "waiting"; position: number; total: number }
  | { kind: "expected" }
  | { kind: "done" }
  | { kind: "missing" };

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Where a player stands on the board, looked up by nickname. */
export function locatePlayer(board: PublicBoard, nickname: string): PlayerLocation {
  const inMatch = (match: PublicMatch) =>
    [...match.team1, ...match.team2].some((player) => sameName(player.nickname, nickname));

  for (const court of board.courts) {
    if (court.match && inMatch(court.match)) {
      return court.match.status === "LIVE"
        ? { kind: "playing", court: court.name }
        : { kind: "called", court: court.name };
    }
  }
  const next = board.nextUp.findIndex(inMatch);
  if (next >= 0) return { kind: "next", position: next + 1 };

  const waiting = board.waiting.findIndex((player) => sameName(player.nickname, nickname));
  if (waiting >= 0) return { kind: "waiting", position: waiting + 1, total: board.waiting.length };

  const entry = board.roster.find((player) => sameName(player.nickname, nickname));
  if (entry?.status === "EXPECTED") return { kind: "expected" };
  if (entry?.status === "DONE") return { kind: "done" };
  return { kind: "missing" };
}
