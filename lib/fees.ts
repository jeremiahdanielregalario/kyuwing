import type { GameDayType, PlayerCategory } from "@prisma/client";
import type { CourtSlot } from "./datetime";

export const CATEGORY_LABELS: Record<PlayerCategory, string> = {
  ACTIVE: "Active member",
  INACTIVE: "Inactive",
  ALUMNI: "Alumni",
  APPLICANT: "Applicant",
  NON_AFFILIATE: "Non-affiliate",
};

export const CATEGORY_SHORT: Record<PlayerCategory, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ALUMNI: "Alumni",
  APPLICANT: "Applicant",
  NON_AFFILIATE: "Non-affiliate",
};

export const GAMEDAY_TYPE_LABELS: Record<GameDayType, string> = {
  REGULAR: "Regular game day",
  TIPID: "Tipid game day",
  MEGA: "MEGA game day",
};

export const PAYMENT_METHOD_LABELS = {
  CASH: "Cash",
  GCASH: "GCash",
  MAYA: "Maya",
  GOTYME: "GoTyme",
  BANK: "Bank transfer",
  OTHER: "Other",
} as const;

export type FeeRuleLike = {
  flatFee: number;
  perGameFee: number;
};

export function computeFee(rule: FeeRuleLike | null | undefined, gamesPlayed: number): number {
  if (!rule) return 0;
  return rule.flatFee + rule.perGameFee * Math.max(0, gamesPlayed);
}

/**
 * Shuttle cost per game under a split-cost game day. The court cost itself is
 * shared evenly as the flat fee (see `buildFeeSchedule`).
 */
export const SPLIT_SHUTTLE_RATES: Record<PlayerCategory, number> = {
  ACTIVE: 20,
  INACTIVE: 25,
  ALUMNI: 25,
  APPLICANT: 25,
  NON_AFFILIATE: 30,
};

/**
 * Price of a tube of 12 shuttles, used for the shuttle cost in the Excel finance tracker
 * (shuttles used = player-games ÷ 4). Editable in the sheet.
 */
export const SHUTTLE_TUBE_PRICE = 880;

/**
 * The finance team's sheet adds ₱10 for applicants and "Plus 1" guests (non-affiliates),
 * on top of their shuttle rate.
 */
export const NON_MEMBER_SURCHARGE: Record<PlayerCategory, number> = {
  ACTIVE: 0,
  INACTIVE: 0,
  ALUMNI: 0,
  APPLICANT: 10,
  NON_AFFILIATE: 10,
};

/** A queue master on duty pays the member shuttle rate and no surcharge, whatever their category. */
export const QUEUE_MASTER_PER_GAME = 20;

/**
 * From this game date (a Manila date key) a queue master on duty pays the base price like everyone
 * else. Earlier game days keep the old waiver, so their settled fees don't change.
 */
export const QUEUE_MASTER_BASE_FEE_FROM = "2026-11-22";

/** Whether a queue master on duty pays the base price on a game day with this date. */
export function queueMasterPaysBase(gameDate: string | null | undefined): boolean {
  if (!gameDate) return true;
  return gameDate.slice(0, 10) >= QUEUE_MASTER_BASE_FEE_FROM;
}

/** The base price (rent ÷ players) is rounded up to the next multiple of this, like the sheet. */
export const BASE_PRICE_STEP = 5;

/**
 * Whether a player is one of the game day's queue masters. The stored name may list more
 * than one ("Roniel & Jgops", "A, B & C") and may use one of the player's other names
 * ("J" for Jgops); matching ignores case and spaces.
 */
export function isQueueMasterOnDuty(
  nickname: string,
  queueMasterName: string | null | undefined,
  aliases: string[] = [],
): boolean {
  if (!queueMasterName) return false;
  const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
  const mine = new Set([nickname, ...aliases].map(key).filter(Boolean));
  return queueMasterName.split(/\s*(?:&|,|\band\b)\s*/i).some((name) => mine.has(key(name)));
}

/** Badminton grip, sold on the day, per piece in pesos. */
export const GRIP_PRICE = 20;

/** Charges on top of court and shuttle fees: grips plus any other amount the finance member adds. */
export function extrasTotal(extras: { gripCount: number; otherCharge: number }): number {
  return Math.max(0, extras.gripCount) * GRIP_PRICE + Math.max(0, extras.otherCharge);
}

/** Change owed back when a player hands over more than they owe. */
export function changeDue(total: number, amountPaid: number): number {
  return Math.max(0, amountPaid - total);
}

function slotMinutes(slot: Pick<CourtSlot, "start" | "end">): number {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };
  return Math.max(0, toMinutes(slot.end) - toMinutes(slot.start));
}

/** Court-hours reserved across the plan: hours × courts for every block. */
export function courtHours(plan: Array<Pick<CourtSlot, "start" | "end" | "courts">>): number {
  return plan.reduce((sum, slot) => sum + (slotMinutes(slot) / 60) * slot.courts, 0);
}

/** What the venue charges for the whole plan at a rate per court per hour, in whole pesos. */
export function courtCost(
  plan: Array<Pick<CourtSlot, "start" | "end" | "courts">>,
  ratePerCourtHour: number,
): number {
  return Math.round(courtHours(plan) * ratePerCourtHour);
}

export type FeeSplit = {
  /** How the base price is set: a share of the court cost, or a flat rate the queue master picked. */
  mode: "SPLIT" | "FLAT";
  ratePerCourtHour: number;
  /** The hours the cost is worked out from: the queue master's if set, otherwise the plan's. */
  courtHours: number;
  /** Court-hours worked out from the court plan. */
  plannedCourtHours: number;
  /** Set when a queue master typed the court-hours in, overriding the plan. */
  courtHoursOverridden: boolean;
  courtCost: number;
  /** Players the cost is divided among (everyone who checked in). */
  players: number;
  /** Each player's share of the court cost, rounded up to the next ₱5. */
  splitFee: number;
  /** The base price players pay: `splitFee`, or the flat rate when `mode` is FLAT. */
  flatFee: number;
};

export type PlayerFee = {
  /** Base price: 0 for a queue master on duty on game days before `QUEUE_MASTER_BASE_FEE_FROM`. */
  flatFee: number;
  perGameFee: number;
  /** ₱10 for applicants and Plus 1 guests. */
  surcharge: number;
  /** Discount taken off, never more than the fee itself. */
  voucher: number;
  /** Base price + games × per-game rate + surcharge − voucher. Extras are added separately. */
  total: number;
};

export type FeeSchedule = {
  split: FeeSplit;
  feeFor: (
    category: PlayerCategory,
    gamesPlayed: number,
    options?: { queueMaster?: boolean; voucher?: number },
  ) => PlayerFee;
};

/**
 * Default court rate per court per hour, by venue short code. A game day can override it,
 * and a venue without a default has no court cost until a rate is set on the game day.
 */
export const DEFAULT_COURT_RATES: Record<string, number> = {
  DASC: 300,
  KBC: 250,
};

export function defaultCourtRate(venueShortName: string | null | undefined): number | null {
  if (!venueShortName) return null;
  return DEFAULT_COURT_RATES[venueShortName.trim().toUpperCase()] ?? null;
}

/** The rate a game day is charged at: its own rate if set, otherwise the venue's default. */
export function effectiveCourtRate(
  override: number | null | undefined,
  venueShortName: string | null | undefined,
): number {
  return override ?? defaultCourtRate(venueShortName) ?? 0;
}

/** Suggested flat base fee by venue short code, used when a queue master switches to a flat rate. */
export const DEFAULT_FLAT_BASE_FEES: Record<string, number> = {
  DASC: 150,
  KBC: 100,
};

/** The flat base fee to start from at a venue, or null when the venue has no default. */
export function defaultFlatBaseFee(venueShortName: string | null | undefined): number | null {
  if (!venueShortName) return null;
  return DEFAULT_FLAT_BASE_FEES[venueShortName.trim().toUpperCase()] ?? null;
}

/**
 * One place that decides what a player owes, following the finance team's Gameday Finance
 * Tracker sheet (the standard):
 *
 *   total = base price + games × shuttle rate + ₱10 (applicants and Plus 1s) − voucher
 *
 * The base price is the court cost (rate × hours × courts, summed over blocks, or rate × the
 * court-hours a queue master typed in, which supersede the plan's) divided among
 * everyone who checked in, rounded up to the next ₱5. A queue master on duty pays the base
 * price, ₱20 per game and no surcharge (before `QUEUE_MASTER_BASE_FEE_FROM` the base price was
 * waived, and those game days keep that). Shuttle rates are by category (`SPLIT_SHUTTLE_RATES`). The rate is
 * the game day's own, or the venue's default (DASC ₱300, KBC ₱250 per court per hour).
 *
 * A queue master can instead set a flat base fee (`flatBaseFee`); then everyone pays that as
 * the base price, whatever the court cost and turnout. Everything else stays the same.
 */
export function buildFeeSchedule(input: {
  courtPlan: Array<Pick<CourtSlot, "start" | "end" | "courts">>;
  /** The game day's own rate; leave empty to use the venue's default. */
  ratePerCourtHour: number | null | undefined;
  /** Court-hours a queue master typed in; replaces the plan's hours when set. */
  courtHoursOverride?: number | null;
  /** A flat base price chosen by the queue master; replaces the split when set. */
  flatBaseFee?: number | null;
  venueShortName: string | null | undefined;
  attendees: number;
  /** The game day's date (ISO, UTC midnight of the Manila date); decides the queue master's base price. */
  gameDate?: string | null;
}): FeeSchedule {
  const qmPaysBase = queueMasterPaysBase(input.gameDate);
  const rate = effectiveCourtRate(input.ratePerCourtHour, input.venueShortName);
  const planned = courtHours(input.courtPlan);
  const overridden = input.courtHoursOverride != null && input.courtHoursOverride > 0;
  const hours = overridden ? input.courtHoursOverride! : planned;
  const cost = Math.round(hours * rate);
  const splitFee =
    input.attendees > 0 ? Math.ceil(cost / input.attendees / BASE_PRICE_STEP) * BASE_PRICE_STEP : 0;
  const flat = input.flatBaseFee != null && input.flatBaseFee >= 0;
  const flatFee = flat ? input.flatBaseFee! : splitFee;
  const split: FeeSplit = {
    mode: flat ? "FLAT" : "SPLIT",
    ratePerCourtHour: rate,
    courtHours: hours,
    plannedCourtHours: planned,
    courtHoursOverridden: overridden,
    courtCost: cost,
    players: input.attendees,
    splitFee,
    flatFee,
  };
  return {
    split,
    feeFor: (category, games, options = {}) => {
      const base = options.queueMaster && !qmPaysBase ? 0 : flatFee;
      const perGameFee = options.queueMaster ? QUEUE_MASTER_PER_GAME : SPLIT_SHUTTLE_RATES[category];
      const surcharge = options.queueMaster ? 0 : NON_MEMBER_SURCHARGE[category];
      const before = computeFee({ flatFee: base, perGameFee }, games) + surcharge;
      const voucher = Math.min(before, Math.max(0, Math.round(options.voucher ?? 0)));
      return { flatFee: base, perGameFee, surcharge, voucher, total: before - voucher };
    },
  };
}

function money(amount: number): string {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(Math.abs(amount));
}

export function formatPeso(amount: number): string {
  return `${amount < 0 ? "-" : ""}₱${money(amount)}`;
}

export function formatPesoPdf(amount: number): string {
  return `${amount < 0 ? "-" : ""}PHP ${money(amount)}`;
}
