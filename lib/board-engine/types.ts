import type { CourtSlot } from "@/lib/datetime";

/**
 * Everything the board needs about one game day, in one plain object. The tablet keeps a copy
 * and changes it itself (so the board works on weak or no signal), and the server loads the same
 * shape from the database, applies the same changes, and saves the difference. Times are epoch
 * milliseconds so the object survives JSON and IndexedDB unchanged.
 */
export type EngineState = {
  gameDay: EngineGameDay;
  players: EnginePlayer[];
  matches: EngineMatch[];
  /** Only pending "I'm leaving" requests are loaded; handled ones never come back. */
  leaveRequests: EngineLeaveRequest[];
  requests: EnginePairingRequest[];
  /**
   * The club's player list, for walk-ins and sign-ups (an existing nickname is reused).
   * Loaded only when an operation needs it.
   */
  roster?: RosterEntry[];
};

export type PlayerCategory = "ACTIVE" | "INACTIVE" | "ALUMNI" | "APPLICANT" | "NON_AFFILIATE";
export type SessionStatus = "EXPECTED" | "WAITING" | "PLAYING" | "DONE";
export type MatchStatus = "SUGGESTED" | "LIVE" | "COMPLETED" | "CANCELLED";
export type PaymentMethod = "CASH" | "GCASH" | "MAYA" | "GOTYME" | "BANK" | "OTHER";

export type EngineGameDay = {
  id: string;
  name: string;
  /** ISO string of the UTC midnight of the Manila date. */
  date: string;
  type: "REGULAR" | "TIPID" | "MEGA";
  status: "DRAFT" | "LIVE" | "COMPLETED";
  courtPlan: CourtSlot[];
  notes: string | null;
  queueMasterName: string | null;
  financeMemberName: string | null;
  courtRatePerHour: number | null;
  courtHoursOverride: number | null;
  startedAt: number | null;
  completedAt: number | null;
  venue: { id: string; name: string; shortName: string };
};

/** A sign-up (SessionPlayer) with the player's own details folded in. */
export type EnginePlayer = {
  id: string;
  playerId: string;
  nickname: string;
  fullName: string | null;
  level: string;
  category: PlayerCategory;
  aliases: string[];
  status: SessionStatus;
  joinedAt: number | null;
  queuedAt: number | null;
  lastPlayedAt: number | null;
  gamesPlayed: number;
  permanentPartnerId: string | null;
  priority: boolean;
  paid: boolean;
  amountPaid: number;
  paymentMethod: PaymentMethod | null;
  gripCount: number;
  otherCharge: number;
  otherNote: string | null;
  voucher: number;
  settled: boolean;
  note: string | null;
  /** A player created on the spot (a walk-in not in the database yet). */
  newPlayer?: boolean;
};

export type EngineMatchPlayer = { playerId: string; team: number; slot: number };

export type EngineMatch = {
  id: string;
  courtNumber: number;
  round: number;
  status: MatchStatus;
  free: boolean;
  rejected: string[];
  note: string | null;
  startedAt: number | null;
  endedAt: number | null;
  createdAt: number;
  updatedAt: number;
  players: EngineMatchPlayer[];
};

export type EngineLeaveRequest = {
  id: string;
  sessionPlayerId: string;
  status: "PENDING" | "CONFIRMED" | "DECLINED";
  createdAt: number;
  resolvedAt: number | null;
};

export type EnginePairingRequest = {
  id: string;
  playerId: string;
  type: "PAIR_WITH" | "PLAY_AGAINST";
  targetPlayerId: string;
  active: boolean;
};

export type RosterEntry = {
  id: string;
  nickname: string;
  fullName: string | null;
  level: string;
  category: PlayerCategory;
  aliases: string[];
  active: boolean;
};
