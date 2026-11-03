import type { GameDayType, PlayerCategory } from "@prisma/client";

export const CATEGORY_LABELS: Record<PlayerCategory, string> = {
  ACTIVE: "Active member",
  INACTIVE: "Inactive",
  ALUMNI: "Alumni",
  APPLICANT: "Applicant",
};

export const CATEGORY_SHORT: Record<PlayerCategory, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ALUMNI: "Alumni",
  APPLICANT: "Applicant",
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

function money(amount: number): string {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(Math.abs(amount));
}

export function formatPeso(amount: number): string {
  return `${amount < 0 ? "-" : ""}₱${money(amount)}`;
}

export function formatPesoPdf(amount: number): string {
  return `${amount < 0 ? "-" : ""}PHP ${money(amount)}`;
}
