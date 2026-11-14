import { formatPeso } from "./fees";
import type { FeeRow } from "./board-types";

/**
 * The rows of the Excel report's "Gameday Finance Tracker" sheet, laid out like the finance
 * team's own spreadsheet (verified tick, membership status, name, games, total, mode of
 * payment, voucher, remarks). Pure, so it is unit-tested; the ExcelJS styling lives in the
 * export route.
 */

/** The template's membership status labels. */
export const TRACKER_STATUS: Record<FeeRow["category"], string> = {
  ACTIVE: "Mem",
  INACTIVE: "Inact/Alum",
  ALUMNI: "Inact/Alum",
  APPLICANT: "App",
  NON_AFFILIATE: "Plus 1",
};

/** Mode of payment as the template's dropdown spells it. */
export const TRACKER_PAYMENT: Record<string, string> = {
  CASH: "CASH",
  GCASH: "GCASH",
  BANK: "BANK",
  OTHER: "OTHER",
};

export type TrackerRow = {
  verified: boolean;
  status: string;
  name: string;
  games: number;
  total: number;
  payment: string;
  voucher: number;
  remarks: string;
};

/** Grips, other charges, change given back and any balance, in the template's short style. */
export function trackerRemarks(row: FeeRow): string {
  const parts: string[] = [];
  if (row.gripCount > 0) parts.push(`${row.gripCount} grip${row.gripCount === 1 ? "" : "s"}`);
  if (row.otherCharge > 0) parts.push(`${row.otherNote?.trim() || "Other"} ${formatPeso(row.otherCharge)}`);
  if (row.change > 0) parts.push(`Sukli ${formatPeso(row.change)}${row.settled ? "" : " (not yet given)"}`);
  if (row.balance > 0) parts.push(row.amountPaid > 0 ? `Balance ${formatPeso(row.balance)}` : "Unpaid");
  return parts.join(" · ");
}

/**
 * Everyone who checked in (plus anyone who paid without checking in), members first by
 * status like the template's sheets, then by name.
 */
export function trackerRows(rows: FeeRow[]): TrackerRow[] {
  const order = ["App", "Inact/Alum", "Mem", "Plus 1"];
  return rows
    .filter((row) => row.status !== "EXPECTED" || row.amountPaid > 0)
    .map((row) => ({
      verified: row.paid,
      status: TRACKER_STATUS[row.category],
      name: row.nickname,
      games: row.gamesPlayed,
      total: row.total,
      payment: row.paymentMethod ? (TRACKER_PAYMENT[row.paymentMethod] ?? row.paymentMethod) : "",
      voucher: 0,
      remarks: trackerRemarks(row),
    }))
    .sort(
      (a, b) =>
        order.indexOf(a.status) - order.indexOf(b.status) ||
        a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
}

/** Sheet tab name in the template's style, e.g. "November 18, 2026". */
export function trackerSheetName(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}
