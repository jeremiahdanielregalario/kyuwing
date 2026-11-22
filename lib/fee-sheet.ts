import type { TrackerRow } from "./finance-tracker";

/**
 * The Fees page's "Sheet" view: the Excel report's player table (the Gameday Finance Tracker
 * columns), as a grid whose cells can be selected and copied into Excel or Google Sheets.
 * Pure, so the copy format is unit-tested; the grid itself is `components/app/fee-sheet.tsx`.
 */

export type SheetColumn = {
  key: keyof TrackerRow;
  /** The Excel sheet's own heading. */
  label: string;
  align: "left" | "center" | "right";
  /** Peso amounts: shown as ₱1,234.00 like the sheet, copied as plain numbers. */
  peso?: boolean;
};

/** Same columns, in the same order, as the Excel report's first sheet. */
export const SHEET_COLUMNS: SheetColumn[] = [
  { key: "verified", label: "VERIFIED?", align: "center" },
  { key: "status", label: "Membership Status", align: "center" },
  { key: "name", label: "Name", align: "left" },
  { key: "games", label: "No. of Games", align: "center" },
  { key: "total", label: "Total Amount", align: "right", peso: true },
  { key: "payment", label: "Mode of Payment", align: "center" },
  { key: "voucher", label: "Voucher", align: "right", peso: true },
  { key: "remarks", label: "Remarks", align: "left" },
];

const pesoDisplay = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** What the cell shows, matching the Excel formatting. */
export function displayValue(row: TrackerRow, column: SheetColumn): string {
  const value = row[column.key];
  if (column.key === "verified") return value ? "✓" : "";
  if (column.peso) return `₱${pesoDisplay.format(Number(value))}`;
  return String(value ?? "");
}

/**
 * What the cell copies as: what Excel would hold. Amounts and games as plain numbers (so they
 * paste as numbers, not text), VERIFIED? as TRUE/FALSE like the sheet's checkbox column.
 */
export function copyValue(row: TrackerRow, column: SheetColumn): string {
  const value = row[column.key];
  if (column.key === "verified") return value ? "TRUE" : "FALSE";
  return String(value ?? "");
}

export type Cell = { row: number; col: number };
export type Range = { top: number; left: number; bottom: number; right: number };

/** The rectangle between two corners, in either order. */
export function rangeOf(a: Cell, b: Cell): Range {
  return {
    top: Math.min(a.row, b.row),
    bottom: Math.max(a.row, b.row),
    left: Math.min(a.col, b.col),
    right: Math.max(a.col, b.col),
  };
}

export function inRange(range: Range | null, row: number, col: number): boolean {
  return !!range && row >= range.top && row <= range.bottom && col >= range.left && col <= range.right;
}

/** Row and column counts kept inside the sheet (rows/columns can shrink while a range is held). */
export function clampRange(range: Range, rows: number, cols: number): Range | null {
  if (rows === 0 || cols === 0 || range.top > rows - 1 || range.left > cols - 1) return null;
  return { ...range, bottom: Math.min(range.bottom, rows - 1), right: Math.min(range.right, cols - 1) };
}

function grid(rows: TrackerRow[], range: Range, headers: boolean): string[][] {
  const columns = SHEET_COLUMNS.slice(range.left, range.right + 1);
  const body = rows
    .slice(range.top, range.bottom + 1)
    .map((row) => columns.map((column) => copyValue(row, column)));
  return headers ? [columns.map((column) => column.label), ...body] : body;
}

/** Tab-separated, one line per row: what Excel and Google Sheets read as cells when pasted. */
export function rangeToTsv(rows: TrackerRow[], range: Range, headers = false): string {
  const clean = (value: string) => value.replace(/[\t\r\n]+/g, " ");
  return grid(rows, range, headers)
    .map((line) => line.map(clean).join("\t"))
    .join("\n");
}

/** The same cells as an HTML table, which some apps (Word, Docs, Sheets) paste more faithfully. */
export function rangeToHtml(rows: TrackerRow[], range: Range, headers = false): string {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const lines = grid(rows, range, headers).map(
    (line, index) =>
      `<tr>${line.map((value) => (headers && index === 0 ? `<th>${escape(value)}</th>` : `<td>${escape(value)}</td>`)).join("")}</tr>`,
  );
  return `<table>${lines.join("")}</table>`;
}
