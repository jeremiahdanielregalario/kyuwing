import "server-only";

import { cache } from "react";
import type { GameDayStatus, MatchStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { BoardData, FeeReport } from "./board-types";
import { loadEngineState, loadRoster, stateHash } from "./board-store";
import type { GameDayBootstrap } from "./offline/game-day-sync";
import { toBoardData, toFeeReport } from "./board-engine/view";
import type { CourtSlot } from "./datetime";
import { awardsByPlayer, type AwardRow, type PlayerAward } from "./awards";
import { levelLabel } from "./levels";
import { toPublicRoster, type PublicRoster } from "./public-roster";
import { recencySummary, toRecencySnapshot, type RecencyEntry, type RecencySnapshot } from "./recency";

const gameDayInclude = {
  venue: true,
  players: {
    include: { player: true },
    orderBy: { player: { nickname: "asc" } },
  },
  requests: true,
} satisfies Prisma.GameDayInclude;

/** The board for one game day, from the same engine state the tablet works on. */
async function loadBoardData(gameDayId: string, slotParam: number | null): Promise<BoardData | null> {
  const state = await loadEngineState(prisma, gameDayId);
  return state ? toBoardData(state, { slot: slotParam, now: Date.now() }) : null;
}

export async function getGameDay(gameDayId: string) {
  return prisma.gameDay.findUnique({
    where: { id: gameDayId },
    include: gameDayInclude,
  });
}

export async function getGameDays() {
  return prisma.gameDay.findMany({
    include: {
      venue: true,
      _count: { select: { players: true, matches: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function getCurrentGameDayId() {
  const live = await prisma.gameDay.findFirst({
    where: { status: "LIVE" },
    orderBy: { date: "desc" },
    select: { id: true },
  });
  if (live) return live.id;

  const today = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);
  const todayGame = await prisma.gameDay.findFirst({
    where: { date: todayDate, status: { in: ["DRAFT", "LIVE"] } },
    select: { id: true },
  });
  return todayGame?.id ?? null;
}

export async function getPlayers() {
  return prisma.player.findMany({
    orderBy: [{ active: "desc" }, { nickname: "asc" }],
  });
}

/** The public roster page: active players, recency and awards with private fields stripped. */
export async function getPublicRoster(): Promise<PublicRoster> {
  const [players, attendance, awards] = await Promise.all([
    prisma.player.findMany({
      select: { id: true, nickname: true, fullName: true, level: true, category: true, active: true },
    }),
    getAttendanceOverview(),
    getAwardsOverview(),
  ]);
  return toPublicRoster(players, attendance, awards);
}

export type AttendanceEventDto = {
  id: string;
  date: string;
  label: string | null;
  kind: "GAMEDAY" | "TOURNAMENT";
  played: number;
  waitlist: number;
  /** Who was on the list, by nickname (no contact details). */
  players: { nickname: string; level: string; status: "PLAYED" | "WAITLIST" }[];
};

export type PlayerHistoryItem = {
  eventId: string;
  date: string;
  label: string | null;
  kind: "GAMEDAY" | "TOURNAMENT";
  status: "PLAYED" | "WAITLIST";
};

export type AttendanceOverview = {
  events: AttendanceEventDto[];
  /** Every logged list a player appears on, newest first. */
  historyByPlayer: Record<string, PlayerHistoryItem[]>;
  byPlayer: Record<string, RecencySnapshot>;
};

/**
 * All imported attendance lists plus a per-player recency snapshot.
 * Lists are small (a club plays a few times a month), so we score in memory.
 */
export async function getAttendanceOverview(): Promise<AttendanceOverview> {
  const events = await prisma.attendanceEvent.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      entries: {
        select: { playerId: true, status: true, player: { select: { nickname: true, level: true } } },
      },
    },
  });

  const rowsByPlayer = new Map<string, RecencyEntry[]>();
  const historyByPlayer: Record<string, PlayerHistoryItem[]> = {};
  for (const event of events) {
    for (const entry of event.entries) {
      (historyByPlayer[entry.playerId] ??= []).push({
        eventId: event.id,
        date: event.date.toISOString(),
        label: event.label,
        kind: event.kind,
        status: entry.status,
      });
      const rows = rowsByPlayer.get(entry.playerId) ?? [];
      rows.push({ date: event.date, status: entry.status, kind: event.kind });
      rowsByPlayer.set(entry.playerId, rows);
    }
  }

  const now = new Date();
  const byPlayer: Record<string, RecencySnapshot> = {};
  for (const [playerId, rows] of rowsByPlayer) {
    byPlayer[playerId] = toRecencySnapshot(recencySummary(rows, now));
  }

  return {
    events: events.map((event) => ({
      id: event.id,
      date: event.date.toISOString(),
      label: event.label,
      kind: event.kind,
      played: event.entries.filter((entry) => entry.status === "PLAYED").length,
      waitlist: event.entries.filter((entry) => entry.status === "WAITLIST").length,
      players: event.entries
        .map((entry) => ({
          nickname: entry.player.nickname,
          level: levelLabel(entry.player.level),
          status: entry.status,
        }))
        .sort((a, b) => a.nickname.localeCompare(b.nickname, undefined, { sensitivity: "base" })),
    })),
    historyByPlayer,
    byPlayer,
  };
}

export type TournamentDto = {
  id: string;
  name: string;
  date: string;
  divisions: { name: string; champion: string[]; runnerUp: string[] }[];
};

export type AwardsOverview = {
  tournaments: TournamentDto[];
  byPlayer: Record<string, PlayerAward[]>;
};

/** Past tournament podiums, for the Players page and each player's awards icon. */
export async function getAwardsOverview(): Promise<AwardsOverview> {
  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ date: "desc" }, { name: "asc" }],
    include: {
      awards: {
        orderBy: [{ position: "asc" }, { place: "asc" }],
        include: {
          players: {
            orderBy: { position: "asc" },
            select: { player: { select: { id: true, nickname: true } } },
          },
        },
      },
    },
  });

  const rows: AwardRow[] = [];
  const dtos: TournamentDto[] = [];
  for (const tournament of tournaments) {
    const date = tournament.date.toISOString();
    const divisions = new Map<string, TournamentDto["divisions"][number]>();
    for (const award of tournament.awards) {
      const players = award.players.map((member) => member.player);
      rows.push({
        tournamentId: tournament.id,
        tournament: tournament.name,
        date,
        division: award.division,
        place: award.place,
        position: award.position,
        players,
      });
      const division = divisions.get(award.division) ?? { name: award.division, champion: [], runnerUp: [] };
      const nicks = players.map((player) => player.nickname);
      if (award.place === "CHAMPION") division.champion = nicks;
      else division.runnerUp = nicks;
      divisions.set(award.division, division);
    }
    dtos.push({ id: tournament.id, name: tournament.name, date, divisions: [...divisions.values()] });
  }
  return { tournaments: dtos, byPlayer: awardsByPlayer(rows) };
}

export async function getVenues() {
  return prisma.venue.findMany({ orderBy: { name: "asc" } });
}

async function loadFeeReport(gameDayId: string): Promise<FeeReport | null> {
  const state = await loadEngineState(prisma, gameDayId);
  return state ? toFeeReport(state, Date.now()) : null;
}

export async function getMatchHistoryForPairing(gameDayId: string) {
  return prisma.match.findMany({
    where: { gameDayId, status: "COMPLETED" },
    include: { players: true },
    orderBy: { round: "asc" },
  });
}

export type GameDayListRow = Awaited<ReturnType<typeof getGameDays>>[number];
export type PlayerRow = Awaited<ReturnType<typeof getPlayers>>[number];
export type VenueRow = Awaited<ReturnType<typeof getVenues>>[number];
export type MatchStatusFilter = MatchStatus | GameDayStatus;
export type CourtPlan = CourtSlot[];

// One load per request: a page and its title (generateMetadata) both ask for the same game day.
const cachedBoardData = cache(loadBoardData);
export function getBoardData(gameDayId: string, slotParam?: number | null): Promise<BoardData | null> {
  return cachedBoardData(gameDayId, slotParam ?? null);
}

export const getFeeReport = cache(loadFeeReport);

/** What a game day page needs to start working on the device: the game day, the roster and a fingerprint. */
export async function getGameDayBootstrap(gameDayId: string): Promise<GameDayBootstrap | null> {
  const [state, roster] = await Promise.all([loadEngineState(prisma, gameDayId), loadRoster(prisma)]);
  if (!state) return null;
  return { state, roster, hash: stateHash(state), loadedAt: Date.now() };
}
