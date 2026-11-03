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
  /** `split` when the game day has its own court rate, otherwise the venue's rules. */
  mode: "VENUE" | "SPLIT";
  split: FeeSplit | null;
  feeFor: (
    category: PlayerCategory,
    gamesPlayed: number,
  ) => { flatFee: number; perGameFee: number; total: number };
};

/**
 * One place that decides what a player owes.
 *
 * With a court rate per hour on the game day, the court cost (rate × hours ×
 * courts, summed over blocks) is divided evenly among everyone who checked in
 * and rounded up, and that share is the flat fee for all. Shuttles are charged
 * per game by category. With no rate, the venue's fee rules apply as before.
 */
export function buildFeeSchedule(input: {
  type: GameDayType;
  courtPlan: Array<Pick<CourtSlot, "start" | "end" | "courts">>;
  ratePerCourtHour: number | null | undefined;
  attendees: number;
  rules: Array<FeeRuleLike & { dayType: GameDayType; category: PlayerCategory }>;
}): FeeSchedule {
  const rate = input.ratePerCourtHour;
  if (rate == null) {
    return {
      mode: "VENUE",
      split: null,
      feeFor: (category, games) => {
        const rule = input.rules.find((r) => r.dayType === input.type && r.category === category);
        return {
          flatFee: rule?.flatFee ?? 0,
          perGameFee: rule?.perGameFee ?? 0,
          total: computeFee(rule, games),
        };
      },
    };
  }

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
    mode: "SPLIT",
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
