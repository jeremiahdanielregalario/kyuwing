import type {
  BoardData,
  BoardGameDay,
  BoardMatch,
  BoardMatchPlayer,
  BoardPlayer,
  FeeReport,
  FeeRow,
} from "@/lib/board-types";
import { currentSlotIndex, elapsedMinutes, QUEUED_COURT } from "@/lib/datetime";
import { changeDue, extrasTotal } from "@/lib/fees";
import { levelLabel } from "@/lib/levels";
import { feeOf, feeSchedule } from "./fees";
import { isActive } from "./helpers";
import type { EngineMatch, EngineState } from "./types";

const iso = (value: number | null) => (value === null ? null : new Date(value).toISOString());

const byNickname = (a: { nickname: string }, b: { nickname: string }) =>
  a.nickname.localeCompare(b.nickname, "en");

export function toGameDayDto(state: EngineState): BoardGameDay {
  const { gameDay } = state;
  return {
    id: gameDay.id,
    name: gameDay.name,
    date: gameDay.date,
    type: gameDay.type,
    status: gameDay.status,
    notes: gameDay.notes,
    queueMasterName: gameDay.queueMasterName,
    financeMemberName: gameDay.financeMemberName,
    courtRatePerHour: gameDay.courtRatePerHour,
    startedAt: iso(gameDay.startedAt),
    courtPlan: gameDay.courtPlan,
    venue: gameDay.venue,
  };
}

function toBoardPlayers(state: EngineState): BoardPlayer[] {
  const byPlayer = new Map(state.players.map((row) => [row.playerId, row]));
  return [...state.players].sort(byNickname).map((row) => ({
    sessionPlayerId: row.id,
    playerId: row.playerId,
    nickname: row.nickname,
    fullName: row.fullName,
    level: row.level,
    levelLabel: levelLabel(row.level),
    category: row.category,
    status: row.status,
    joinedAt: iso(row.joinedAt),
    queuedAt: iso(row.queuedAt),
    gamesPlayed: row.gamesPlayed,
    permanentPartnerId: row.permanentPartnerId,
    permanentPartnerNickname: row.permanentPartnerId
      ? (byPlayer.get(row.permanentPartnerId)?.nickname ?? null)
      : null,
    priority: row.priority,
    paid: row.paid,
    amountPaid: row.amountPaid,
    note: row.note,
    requests: state.requests
      .filter((request) => request.playerId === row.playerId && request.active)
      .map((request) => ({
        id: request.id,
        type: request.type,
        targetPlayerId: request.targetPlayerId,
        targetNickname: byPlayer.get(request.targetPlayerId)?.nickname ?? "Unknown",
      })),
  }));
}

export function toBoardMatch(state: EngineState, match: EngineMatch): BoardMatch {
  const toPlayer = (row: EngineMatch["players"][number]): BoardMatchPlayer => {
    const player = state.players.find((item) => item.playerId === row.playerId);
    const level = player?.level ?? "X";
    return {
      playerId: row.playerId,
      sessionPlayerId: player?.id ?? "",
      nickname: player?.nickname ?? "Unknown",
      level,
      levelLabel: levelLabel(level),
      team: row.team,
      slot: row.slot,
    };
  };
  const sorted = [...match.players].sort((a, b) => a.team - b.team || a.slot - b.slot);
  return {
    id: match.id,
    courtNumber: match.courtNumber,
    round: match.round,
    status: match.status,
    free: match.free,
    startedAt: iso(match.startedAt),
    endedAt: iso(match.endedAt),
    changedAt: new Date(match.updatedAt).toISOString(),
    note: match.note,
    team1: sorted.filter((row) => row.team === 1).map(toPlayer),
    team2: sorted.filter((row) => row.team === 2).map(toPlayer),
  };
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Finished games, newest first. */
export function completedMatches(state: EngineState): EngineMatch[] {
  return state.matches
    .filter((match) => match.status === "COMPLETED")
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0) || byId(a, b));
}

/**
 * The board as the queue board draws it, for the court block `slot` (the one in play at `now`
 * when not given or out of range).
 */
export function toBoardData(state: EngineState, options: { slot?: number | null; now: number }): BoardData {
  const plan = state.gameDay.courtPlan;
  const { slot, now } = options;
  const planIndex =
    slot !== null && slot !== undefined && slot >= 0 && slot < plan.length
      ? slot
      : currentSlotIndex(plan, new Date(now));
  const activeSlot = plan[planIndex];

  const active = state.matches
    .filter(isActive)
    .sort((a, b) => a.courtNumber - b.courtNumber || a.createdAt - b.createdAt || byId(a, b))
    .map((match) => toBoardMatch(state, match));
  const recent = completedMatches(state)
    .slice(0, 8)
    .map((match) => toBoardMatch(state, match));

  const waiting = state.players.filter((row) => row.status === "WAITING");
  const nowDate = new Date(now);
  const waitMinutes = waiting.map((row) => elapsedMinutes(iso(row.queuedAt ?? row.joinedAt), nowDate));
  const courtsTotal = activeSlot?.courts ?? 0;
  // Games in the Next up line hold no court.
  const busy = new Set(
    active.filter((match) => match.courtNumber !== QUEUED_COURT).map((match) => match.courtNumber),
  );
  const open = Array.from({ length: courtsTotal }, (_, index) => index + 1).filter(
    (court) => !busy.has(court),
  );
  const sessionById = new Map(state.players.map((row) => [row.id, row]));

  return {
    gameDay: toGameDayDto(state),
    leaveRequests: state.leaveRequests
      .filter(
        (request) =>
          request.status === "PENDING" && sessionById.get(request.sessionPlayerId)?.status !== "DONE",
      )
      .sort((a, b) => a.createdAt - b.createdAt)
      .flatMap((request) => {
        const row = sessionById.get(request.sessionPlayerId);
        return row
          ? [
              {
                id: request.id,
                sessionPlayerId: request.sessionPlayerId,
                nickname: row.nickname,
                playerStatus: row.status,
                createdAt: new Date(request.createdAt).toISOString(),
              },
            ]
          : [];
      }),
    players: toBoardPlayers(state),
    activeMatches: active,
    recentMatches: recent,
    stats: {
      expected: state.players.filter((row) => row.status === "EXPECTED").length,
      waiting: waiting.length,
      playing: state.players.filter((row) => row.status === "PLAYING").length,
      done: state.players.filter((row) => row.status === "DONE").length,
      total: state.players.length,
      // Free games are played but not counted as games.
      gamesCompleted: state.matches.filter((match) => match.status === "COMPLETED" && !match.free).length,
      courtsTotal,
      courtsBusy: busy.size,
      courtsOpen: open.length,
      averageWaitMinutes: waitMinutes.length
        ? Math.round(waitMinutes.reduce((a, b) => a + b, 0) / waitMinutes.length)
        : 0,
      longestWaitMinutes: waitMinutes.length ? Math.max(...waitMinutes) : 0,
      totalGamesPlayed: state.players.reduce((sum, row) => sum + row.gamesPlayed, 0),
    },
    activeSlotIndex: planIndex,
    serverNow: nowDate.toISOString(),
  };
}

/** Fees for everyone on the game day, as the Fees page and the exports show them. */
export function toFeeReport(state: EngineState, now: number): FeeReport {
  const schedule = feeSchedule(state);
  const rows: FeeRow[] = [...state.players].sort(byNickname).map((row) => {
    const fee = feeOf(state, row, schedule);
    const extras = extrasTotal(row);
    const total = fee.total + extras;
    return {
      sessionPlayerId: row.id,
      playerId: row.playerId,
      nickname: row.nickname,
      level: row.level,
      category: row.category,
      status: row.status,
      gamesPlayed: row.gamesPlayed,
      flatFee: fee.flatFee,
      perGameFee: fee.perGameFee,
      surcharge: fee.surcharge,
      voucher: fee.voucher,
      queueMaster: fee.queueMaster,
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
  return {
    gameDay: toGameDayDto(state),
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
    matches: completedMatches(state).map((match) => toBoardMatch(state, match)),
    generatedAt: new Date(now).toISOString(),
  };
}
