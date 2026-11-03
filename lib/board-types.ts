import type { CourtSlot } from "./datetime";

export type BoardRequest = {
  id: string;
  type: "PAIR_WITH" | "PLAY_AGAINST";
  targetPlayerId: string;
  targetNickname: string;
};

export type BoardPlayer = {
  sessionPlayerId: string;
  playerId: string;
  nickname: string;
  fullName: string | null;
  level: string;
  levelLabel: string;
  category: "ACTIVE" | "INACTIVE" | "ALUMNI" | "APPLICANT";
  status: "EXPECTED" | "WAITING" | "PLAYING" | "DONE";
  joinedAt: string | null;
  queuedAt: string | null;
  gamesPlayed: number;
  permanentPartnerId: string | null;
  permanentPartnerNickname: string | null;
  priority: boolean;
  paid: boolean;
  amountPaid: number;
  note: string | null;
  requests: BoardRequest[];
};

export type BoardMatchPlayer = {
  playerId: string;
  sessionPlayerId: string;
  nickname: string;
  level: string;
  levelLabel: string;
  team: number;
  slot: number;
};

export type BoardMatch = {
  id: string;
  courtNumber: number;
  round: number;
  status: "SUGGESTED" | "LIVE" | "COMPLETED" | "CANCELLED";
  /** Played with a used shuttle near closing; not counted as a game. */
  free: boolean;
  startedAt: string | null;
  endedAt: string | null;
  note: string | null;
  team1: BoardMatchPlayer[];
  team2: BoardMatchPlayer[];
};

export type BoardGameDay = {
  id: string;
  name: string;
  date: string;
  type: "REGULAR" | "TIPID" | "MEGA";
  status: "DRAFT" | "LIVE" | "COMPLETED";
  notes: string | null;
  startedAt: string | null;
  courtPlan: CourtSlot[];
  venue: { id: string; name: string; shortName: string };
};

export type BoardStats = {
  expected: number;
  waiting: number;
  playing: number;
  done: number;
  total: number;
  gamesCompleted: number;
  courtsTotal: number;
  courtsBusy: number;
  courtsOpen: number;
  averageWaitMinutes: number;
  longestWaitMinutes: number;
  totalGamesPlayed: number;
};

export type BoardData = {
  gameDay: BoardGameDay;
  players: BoardPlayer[];
  activeMatches: BoardMatch[];
  recentMatches: BoardMatch[];
  stats: BoardStats;
  activeSlotIndex: number;
  serverNow: string;
};

export type FeeRow = {
  sessionPlayerId: string;
  playerId: string;
  nickname: string;
  level: string;
  category: "ACTIVE" | "INACTIVE" | "ALUMNI" | "APPLICANT";
  status: string;
  gamesPlayed: number;
  flatFee: number;
  perGameFee: number;
  total: number;
  paid: boolean;
  amountPaid: number;
  balance: number;
  paymentMethod: string | null;
};

export type FeeReport = {
  gameDay: BoardGameDay;
  rows: FeeRow[];
  summary: {
    totalPlayers: number;
    totalGames: number;
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    paidPlayers: number;
    unpaidPlayers: number;
  };
  matches: BoardMatch[];
  generatedAt: string;
};
