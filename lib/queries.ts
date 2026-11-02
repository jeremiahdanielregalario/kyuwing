import "server-only";

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
import { currentSlotIndex, elapsedMinutes, parseCourtPlan, type CourtSlot } from "./datetime";
import { computeFee } from "./fees";
import { levelLabel } from "./levels";

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
    targetScore: gameDay.targetScore,
    notes: gameDay.notes,
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
    score1: match.score1,
    score2: match.score2,
    startedAt: match.startedAt?.toISOString() ?? null,
    endedAt: match.endedAt?.toISOString() ?? null,
    note: match.note,
    team1: sorted.filter((row) => row.team === 1).map(toPlayer),
    team2: sorted.filter((row) => row.team === 2).map(toPlayer),
  };
}

export async function getBoardData(gameDayId: string, slotParam?: number | null): Promise<BoardData | null> {
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

  const [activeMatches, recentMatches] = await Promise.all([
    prisma.match.findMany({
      where: { gameDayId, status: { in: ["SUGGESTED", "LIVE"] } },
      include: { players: { include: { player: true } } },
      orderBy: [{ courtNumber: "asc" }, { createdAt: "asc" }],
    }),
    prisma.match.findMany({
      where: { gameDayId, status: "COMPLETED" },
      include: { players: { include: { player: true } } },
      orderBy: { endedAt: "desc" },
      take: 8,
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
  const busyCourtNumbers = new Set(
    mappedActive
      .filter((match) => match.status === "LIVE" || match.status === "SUGGESTED")
      .map((match) => match.courtNumber),
  );
  const openCourtNumbers = Array.from({ length: courtsTotal }, (_, index) => index + 1).filter(
    (court) => !busyCourtNumbers.has(court),
  );
  const completedCount = await prisma.match.count({ where: { gameDayId, status: "COMPLETED" } });

  return {
    gameDay: toGameDayDto(gameDay),
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

export async function getVenuesWithFees() {
  return prisma.venue.findMany({
    include: { feeRules: true },
    orderBy: { name: "asc" },
  });
}

export async function getVenues() {
  return prisma.venue.findMany({ orderBy: { name: "asc" } });
}

export async function getFeeReport(gameDayId: string): Promise<FeeReport | null> {
  const gameDay = await prisma.gameDay.findUnique({
    where: { id: gameDayId },
    include: {
      venue: { include: { feeRules: true } },
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

  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  for (const match of gameDay.matches) {
    if (match.score1 === null || match.score2 === null) continue;
    const winner = match.score1 > match.score2 ? 1 : 2;
    for (const row of match.players) {
      const target = row.team === winner ? wins : losses;
      target.set(row.playerId, (target.get(row.playerId) ?? 0) + 1);
    }
  }

  const rows: FeeRow[] = gameDay.players.map((row) => {
    const rule = gameDay.venue.feeRules.find(
      (candidate) => candidate.dayType === gameDay.type && candidate.category === row.player.category,
    );
    const total = computeFee(rule, row.gamesPlayed);
    return {
      sessionPlayerId: row.id,
      playerId: row.playerId,
      nickname: row.player.nickname,
      level: row.player.level,
      category: row.player.category,
      status: row.status,
      gamesPlayed: row.gamesPlayed,
      wins: wins.get(row.playerId) ?? 0,
      losses: losses.get(row.playerId) ?? 0,
      flatFee: rule?.flatFee ?? 0,
      perGameFee: rule?.perGameFee ?? 0,
      total,
      paid: row.paid,
      amountPaid: row.amountPaid,
      balance: Math.max(0, total - row.amountPaid),
      paymentMethod: row.paymentMethod,
    };
  });

  const sessionByPlayer = new Map(gameDay.players.map((row) => [row.playerId, row.id]));
  const matchDtos = gameDay.matches.map((match) => toBoardMatch(match, sessionByPlayer));

  return {
    gameDay: toGameDayDto(gameDay),
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
export type VenueRow = Awaited<ReturnType<typeof getVenuesWithFees>>[number];
export type MatchStatusFilter = MatchStatus | GameDayStatus;
export type CourtPlan = CourtSlot[];
