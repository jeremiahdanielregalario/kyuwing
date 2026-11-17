/**
 * The view-only fees sheet the finance member opens from a shared link, to record payments
 * while the queue master runs the board.
 *
 * Built from the Fees page's report but carries only what recording needs: nickname, games,
 * the amounts and how each player paid. No full names, contacts, categories, notes or the
 * "other charge" note. Pure, so it can be unit-tested.
 */
import type { BoardGameDay, FeeReport, FeeRow } from "./board-types";
import { PAYMENT_METHOD_LABELS } from "./fees";

export type PublicFeeLine = {
  nickname: string;
  games: number;
  /** Court and shuttle fee after surcharge and voucher, before grips and other charges. */
  fee: number;
  /** Grips and other charges. */
  extras: number;
  total: number;
  amountPaid: number;
  balance: number;
  /** Cash to hand back. */
  change: number;
  paid: boolean;
  settled: boolean;
  /** "Cash", "GCash", …, or null when nothing is recorded yet. */
  method: string | null;
};

export type PublicFeeSheet = {
  gameDay: { name: string; date: string; venue: string; status: BoardGameDay["status"] };
  lines: PublicFeeLine[];
  summary: {
    players: number;
    games: number;
    billed: number;
    collected: number;
    outstanding: number;
    paidPlayers: number;
    unpaidPlayers: number;
  };
  generatedAt: string;
};

const methodLabel = (method: string | null) =>
  method ? (PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? "Other") : null;

function toLine(row: FeeRow): PublicFeeLine {
  return {
    nickname: row.nickname,
    games: row.gamesPlayed,
    fee: row.total - row.extras,
    extras: row.extras,
    total: row.total,
    amountPaid: row.amountPaid,
    balance: row.balance,
    change: row.change,
    paid: row.paid,
    settled: row.settled,
    method: row.paid || row.amountPaid > 0 ? methodLabel(row.paymentMethod) : null,
  };
}

/** Everyone on the game day's list, by nickname, so the sheet reads like the Fees page. */
export function toPublicFeeSheet(
  report: Pick<FeeReport, "gameDay" | "rows" | "summary" | "generatedAt">,
): PublicFeeSheet {
  return {
    gameDay: {
      name: report.gameDay.name,
      date: report.gameDay.date,
      venue: report.gameDay.venue.name,
      status: report.gameDay.status,
    },
    lines: report.rows
      .map(toLine)
      .sort((a, b) => a.nickname.localeCompare(b.nickname, undefined, { sensitivity: "base" })),
    summary: {
      players: report.summary.totalPlayers,
      games: report.summary.totalGames,
      billed: report.summary.totalBilled,
      collected: report.summary.totalCollected,
      outstanding: report.summary.totalOutstanding,
      paidPlayers: report.summary.paidPlayers,
      unpaidPlayers: report.summary.unpaidPlayers,
    },
    generatedAt: report.generatedAt,
  };
}
