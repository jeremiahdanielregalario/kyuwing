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
  ratePerCourtHour: number;
  courtHours: number;
  courtCost: number;
  /** Players the cost is divided among (everyone who checked in). */
  players: number;
  /** Each player's share of the court cost, rounded up to the next peso. */
  flatFee: number;
};

export type FeeSchedule = {
  split: FeeSplit;
  feeFor: (
    category: PlayerCategory,
    gamesPlayed: number,
  ) => { flatFee: number; perGameFee: number; total: number };
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

/**
 * One place that decides what a player owes.
 *
 * The court cost (rate × hours × courts, summed over blocks) is divided evenly among
 * everyone who checked in and rounded up; that share is the flat fee for all. The rate is
 * the game day's own, or the venue's default (DASC ₱300, KBC ₱250 per court per hour).
 * Shuttles are charged per game by category.
 */
export function buildFeeSchedule(input: {
  courtPlan: Array<Pick<CourtSlot, "start" | "end" | "courts">>;
  /** The game day's own rate; leave empty to use the venue's default. */
  ratePerCourtHour: number | null | undefined;
  venueShortName: string | null | undefined;
  attendees: number;
}): FeeSchedule {
  const rate = effectiveCourtRate(input.ratePerCourtHour, input.venueShortName);
  const cost = courtCost(input.courtPlan, rate);
  const flatFee = input.attendees > 0 ? Math.ceil(cost / input.attendees) : 0;
  const split: FeeSplit = {
    ratePerCourtHour: rate,
    courtHours: courtHours(input.courtPlan),
    courtCost: cost,
    players: input.attendees,
    flatFee,
  };
  return {
    split,
    feeFor: (category, games) => {
      const perGameFee = SPLIT_SHUTTLE_RATES[category];
      return { flatFee, perGameFee, total: computeFee({ flatFee, perGameFee }, games) };
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
