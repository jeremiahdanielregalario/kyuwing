import "server-only";

import { cache } from "react";
import type { GameDayStatus, MatchStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";
import type {
  BoardData,
  BoardGameDay,
  BoardMatch,
  BoardMatchPlayer,
  BoardPlayer,
  FeeReport,
  FeeRow,
} from "./board-types";
import { currentSlotIndex, elapsedMinutes, parseCourtPlan, QUEUED_COURT, type CourtSlot } from "./datetime";
import { buildFeeSchedule, changeDue, extrasTotal } from "./fees";
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

type GameDayWithPlayers = Prisma.GameDayGetPayload<{ include: typeof gameDayInclude }>;

function toGameDayDto(gameDay: GameDayWithPlayers): BoardGameDay {
  return {
    id: gameDay.id,
    name: gameDay.name,
    date: gameDay.date.toISOString(),
    type: gameDay.type,
    status: gameDay.status,
    notes: gameDay.notes,
    queueMasterName: gameDay.queueMasterName,
    financeMemberName: gameDay.financeMemberName,
    courtRatePerHour: gameDay.courtRatePerHour,
    startedAt: gameDay.startedAt?.toISOString() ?? null,
    courtPlan: parseCourtPlan(gameDay.courtPlan),
    venue: {
      id: gameDay.venue.id,
      name: gameDay.venue.name,
      shortName: gameDay.venue.shortName,
    },
  };
}

function toBoardPlayers(gameDay: GameDayWithPlayers): BoardPlayer[] {
  const sessionByPlayer = new Map(gameDay.players.map((row) => [row.playerId, row]));
  return gameDay.players.map((row) => {
    const partner = row.permanentPartnerId ? sessionByPlayer.get(row.permanentPartnerId) : undefined;
    return {
      sessionPlayerId: row.id,
      playerId: row.playerId,
      nickname: row.player.nickname,
      fullName: row.player.fullName,
      level: row.player.level,
      levelLabel: levelLabel(row.player.level),
      category: row.player.category,
      status: row.status,
      joinedAt: row.joinedAt?.toISOString() ?? null,
      queuedAt: row.queuedAt?.toISOString() ?? null,
      gamesPlayed: row.gamesPlayed,
      permanentPartnerId: row.permanentPartnerId,
      permanentPartnerNickname: partner?.player.nickname ?? null,
      priority: row.priority,
      paid: row.paid,
      amountPaid: row.amountPaid,
      note: row.note,
      requests: gameDay.requests
        .filter((request) => request.playerId === row.playerId && request.active)
        .map((request) => ({
          id: request.id,
          type: request.type,
          targetPlayerId: request.targetPlayerId,
          targetNickname: sessionByPlayer.get(request.targetPlayerId)?.player.nickname ?? "Unknown",
        })),
    };
  });
}

type MatchWithPlayers = Prisma.MatchGetPayload<{
  include: { players: { include: { player: true } } };
}>;

function toBoardMatch(match: MatchWithPlayers, sessionByPlayer: Map<string, string>): BoardMatch {
  const toPlayer = (row: MatchWithPlayers["players"][number]): BoardMatchPlayer => ({
    playerId: row.playerId,
    sessionPlayerId: sessionByPlayer.get(row.playerId) ?? "",
    nickname: row.player.nickname,
    level: row.player.level,
    levelLabel: levelLabel(row.player.level),
    team: row.team,
    slot: row.slot,
  });

  const sorted = [...match.players].sort((a, b) => a.team - b.team || a.slot - b.slot);
  return {
    id: match.id,
    courtNumber: match.courtNumber,
    round: match.round,
    status: match.status,
    free: match.free,
    startedAt: match.startedAt?.toISOString() ?? null,
    endedAt: match.endedAt?.toISOString() ?? null,
    changedAt: match.updatedAt.toISOString(),
    note: match.note,
    team1: sorted.filter((row) => row.team === 1).map(toPlayer),
    team2: sorted.filter((row) => row.team === 2).map(toPlayer),
  };
}

async function loadBoardData(gameDayId: string, slotParam: number | null): Promise<BoardData | null> {
  const gameDay = await prisma.gameDay.findUnique({
    where: { id: gameDayId },
    include: gameDayInclude,
  });
  if (!gameDay) return null;

  const plan = parseCourtPlan(gameDay.courtPlan);
  const planIndex =
    slotParam !== null && slotParam !== undefined && slotParam >= 0 && slotParam < plan.length
      ? slotParam
      : currentSlotIndex(plan);
  const activeSlot = plan[planIndex];

  const [activeMatches, recentMatches, pendingLeaves] = await Promise.all([
    prisma.match.findMany({
      where: { gameDayId, status: { in: ["SUGGESTED", "LIVE"] } },
      include: { players: { include: { player: true } } },
      orderBy: [{ courtNumber: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.match.findMany({
      where: { gameDayId, status: "COMPLETED" },
      include: { players: { include: { player: true } } },
      orderBy: { endedAt: "desc" },
      take: 8,
    }),
    prisma.leaveRequest.findMany({
      where: { gameDayId, status: "PENDING", sessionPlayer: { status: { not: "DONE" } } },
      include: { sessionPlayer: { include: { player: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const sessionByPlayer = new Map(gameDay.players.map((row) => [row.playerId, row.id]));
  const mappedActive = activeMatches.map((match) => toBoardMatch(match, sessionByPlayer));
  const mappedRecent = recentMatches.map((match) => toBoardMatch(match, sessionByPlayer));

  const waiting = gameDay.players.filter((row) => row.status === "WAITING");
  const waitMinutes = waiting.map((row) =>
    row.queuedAt ? elapsedMinutes(row.queuedAt) : elapsedMinutes(row.joinedAt),
  );
  const courtsTotal = activeSlot?.courts ?? 0;
  // Games in the Next up line hold no court.
  const busyCourtNumbers = new Set(
    mappedActive.filter((match) => match.courtNumber !== QUEUED_COURT).map((match) => match.courtNumber),
  );
  const openCourtNumbers = Array.from({ length: courtsTotal }, (_, index) => index + 1).filter(
    (court) => !busyCourtNumbers.has(court),
  );
  // Free games are played but not counted as games.
  const completedCount = await prisma.match.count({ where: { gameDayId, status: "COMPLETED", free: false } });

  return {
    gameDay: toGameDayDto(gameDay),
    leaveRequests: pendingLeaves.map((request) => ({
      id: request.id,
      sessionPlayerId: request.sessionPlayerId,
      nickname: request.sessionPlayer.player.nickname,
      playerStatus: request.sessionPlayer.status,
      createdAt: request.createdAt.toISOString(),
    })),
    players: toBoardPlayers(gameDay),
    activeMatches: mappedActive,
    recentMatches: mappedRecent,
    stats: {
      expected: gameDay.players.filter((row) => row.status === "EXPECTED").length,
      waiting: waiting.length,
      playing: gameDay.players.filter((row) => row.status === "PLAYING").length,
      done: gameDay.players.filter((row) => row.status === "DONE").length,
      total: gameDay.players.length,
      gamesCompleted: completedCount,
      courtsTotal,
      courtsBusy: busyCourtNumbers.size,
      courtsOpen: openCourtNumbers.length,
      averageWaitMinutes: waitMinutes.length
        ? Math.round(waitMinutes.reduce((a, b) => a + b, 0) / waitMinutes.length)
        : 0,
      longestWaitMinutes: waitMinutes.length ? Math.max(...waitMinutes) : 0,
      totalGamesPlayed: gameDay.players.reduce((sum, row) => sum + row.gamesPlayed, 0),
    },
    activeSlotIndex: planIndex,
    serverNow: new Date().toISOString(),
  };
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
  const gameDay = await prisma.gameDay.findUnique({
    where: { id: gameDayId },
    include: {
      venue: true,
      players: { include: { player: true }, orderBy: { player: { nickname: "asc" } } },
      requests: true,
      matches: {
        where: { status: "COMPLETED" },
        include: { players: { include: { player: true } } },
        orderBy: { endedAt: "desc" },
      },
    },
  });
  if (!gameDay) return null;

  const schedule = buildFeeSchedule({
    courtPlan: parseCourtPlan(gameDay.courtPlan),
    ratePerCourtHour: gameDay.courtRatePerHour,
    venueShortName: gameDay.venue.shortName,
    attendees: gameDay.players.filter((row) => row.status !== "EXPECTED").length,
  });
  const rows: FeeRow[] = gameDay.players.map((row) => {
    const fee = schedule.feeFor(row.player.category, row.gamesPlayed);
    const extras = extrasTotal(row);
    const { flatFee, perGameFee } = fee;
    const total = fee.total + extras;
    return {
      sessionPlayerId: row.id,
      playerId: row.playerId,
      nickname: row.player.nickname,
      level: row.player.level,
      category: row.player.category,
      status: row.status,
      gamesPlayed: row.gamesPlayed,
      flatFee,
      perGameFee,
      total,
      gripCount: row.gripCount,
      otherCharge: row.otherCharge,
      otherNote: row.otherNote,
      extras,
      paid: row.paid,
      amountPaid: row.amountPaid,
      balance: Math.max(0, total - row.amountPaid),
      change: changeDue(total, row.amountPaid),
      settled: row.settled,
      paymentMethod: row.paymentMethod,
    };
  });

  const sessionByPlayer = new Map(gameDay.players.map((row) => [row.playerId, row.id]));
  const matchDtos = gameDay.matches.map((match) => toBoardMatch(match, sessionByPlayer));

  return {
    gameDay: toGameDayDto(gameDay),
    scheme: { split: schedule.split },
    rows,
    summary: {
      totalPlayers: rows.length,
      totalGames: rows.reduce((sum, row) => sum + row.gamesPlayed, 0),
      totalBilled: rows.reduce((sum, row) => sum + row.total, 0),
      totalCollected: rows.reduce((sum, row) => sum + row.amountPaid, 0),
      totalOutstanding: rows.reduce((sum, row) => sum + row.balance, 0),
      paidPlayers: rows.filter((row) => row.paid).length,
      unpaidPlayers: rows.filter((row) => !row.paid).length,
    },
    matches: matchDtos,
    generatedAt: new Date().toISOString(),
  };
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
