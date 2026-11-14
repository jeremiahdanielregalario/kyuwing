import type ExcelJS from "exceljs";
import { WORDMARK_SIZE } from "@/lib/brand-logo";
import type { FeeReport } from "@/lib/board-types";
import { formatGameDate } from "@/lib/datetime";
import { SHUTTLE_TUBE_PRICE } from "@/lib/fees";
import { trackerRows, trackerSheetName } from "@/lib/finance-tracker";
import { ONLINE_PAYMENT } from "@/lib/payment";
import { officerLabel } from "@/lib/signup-text";

/**
 * The Excel report's first sheet, built like the finance team's own "Gameday Finance Tracker"
 * spreadsheet, so it can be read (or copied into their workbook) the same way. Server only:
 * ExcelJS is a server-external package.
 */

// The finance team's "Gameday Finance Tracker" spreadsheet: its amber, black borders and fonts.
export const AMBER = "FFFFBF00";
export const HEADER = "FFEBC60F";
export const STRIPE = "FFF3F3F3";
export const WHITE = "FFFFFFFF";
const VERIFIED = "FFB7E1CD";
export const BLACK = "FF000000";
const PESO = "[$₱]#,##0.00";
export const TITLE_FONT = "Antonio";
export const BODY_FONT = "Figtree";

type Edge = Partial<ExcelJS.Borders>;
export const medium = { style: "medium" as const, color: { argb: BLACK } };
export const thin = { style: "thin" as const, color: { argb: BLACK } };
export const boxed: Edge = { left: medium, right: medium, top: medium, bottom: medium };
export const solid = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

/** A label and value pair in the side panel (K:L or N:O), boxed like the template. */
function sideCell(
  sheet: ExcelJS.Worksheet,
  address: string,
  value: ExcelJS.CellValue,
  options: { bold?: boolean; peso?: boolean; center?: boolean } = {},
) {
  const cell = sheet.getCell(address);
  cell.value = value;
  cell.font = { name: BODY_FONT, size: 10, bold: options.bold };
  cell.border = boxed;
  cell.alignment = { vertical: "middle", horizontal: options.center ? "center" : "left" };
  if (options.peso) cell.numFmt = PESO;
}

/** The template's sheet: one row per player, the rent and payment totals at the side. */
export function addFinanceTracker(workbook: ExcelJS.Workbook, report: FeeReport, logoId: number) {
  const sheet = workbook.addWorksheet(trackerSheetName(report.gameDay.date), {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: "FF0000FF" }, defaultRowHeight: 15.75 },
  });
  [
    1.75, 11.38, 20.13, 17.88, 14.75, 14.13, 18.75, 16.63, 25.13, 1.38, 18.88, 12.5, 1, 9.63, 11.75, 1.63,
  ].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  [7.5, 37.5, 30.75, 7.5, 33.75].forEach((height, index) => {
    sheet.getRow(index + 1).height = height;
  });

  // Title band.
  const amberCell = (range: string, value: string, size: number, edges: Edge, center = false) => {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(":")[0]);
    cell.value = value;
    cell.font = { name: TITLE_FONT, bold: true, size, color: { argb: "FF1F1F1F" } };
    cell.fill = solid(AMBER);
    cell.border = edges;
    cell.alignment = { vertical: "middle", horizontal: center ? "center" : "left" };
  };
  amberCell("B2:I2", "Gameday Finance Tracker", 25, boxed, true);
  amberCell("B3:C3", "Recorded by:", 12, { left: medium, top: medium, bottom: medium });
  amberCell("D3:E3", report.gameDay.financeMemberName ?? "", 12, {
    left: medium,
    top: medium,
    bottom: medium,
  });
  amberCell("F3:G3", `${ONLINE_PAYMENT.method} Number:`, 12, { top: medium, bottom: medium });
  amberCell("H3:I3", ONLINE_PAYMENT.mobileDisplay, 18, { top: medium, bottom: medium, right: medium });

  sideCell(sheet, "K2", "Schedule");
  sideCell(sheet, "L2", formatGameDate(report.gameDay.date), { center: true });
  sideCell(sheet, "K3", "Venue");
  sideCell(sheet, "L3", report.gameDay.venue.shortName, { center: true });
  sheet.addImage(logoId, {
    tl: { col: 13.2, row: 1.15 },
    ext: { width: 120, height: (120 * WORDMARK_SIZE.height) / WORDMARK_SIZE.width },
  });

  // Column headings, each with a small example underneath like the template.
  const headings: Array<[string, string, string]> = [
    ["B5", "VERIFIED?", ""],
    ["C5", "Membership Status", "Mem / Inact/Alum / App / Plus 1"],
    ["D5", "Name", "Nickname"],
    ["E5", "No. of Games", "5"],
    ["F5", "Total Amount", "165.00"],
    ["G5", "Mode of Payment", "Cash / GCash"],
    ["H5", "Voucher", "0 / 100 / 150"],
    ["I5", "Remarks", "Sukli 35 GCash"],
  ];
  headings.forEach(([address, label, example], index) => {
    const cell = sheet.getCell(address);
    cell.value = example
      ? {
          richText: [
            { text: `${label}\n`, font: { name: BODY_FONT, bold: true, size: 10 } },
            { text: example, font: { name: BODY_FONT, bold: true, italic: true, size: 8 } },
          ],
        }
      : label;
    cell.font = { name: BODY_FONT, bold: true, size: 10 };
    cell.fill = solid(HEADER);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: medium,
      bottom: medium,
      left: index === 0 ? medium : thin,
      right: index === headings.length - 1 ? medium : thin,
    };
  });

  // One row per player. Totals are the app's own figures, so they match the Fees tab.
  const rows = trackerRows(report.rows);
  const first = 6;
  const last = first + Math.max(rows.length, 1) - 1;
  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(first + index);
    excelRow.height = 22.5;
    const values: ExcelJS.CellValue[] = [
      row.verified,
      row.status,
      row.name,
      row.games,
      row.total,
      row.payment,
      row.voucher,
      row.remarks,
    ];
    values.forEach((value, column) => {
      const cell = excelRow.getCell(column + 2);
      cell.value = value;
      cell.fill = solid(column === 0 || index % 2 === 1 ? STRIPE : WHITE);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { name: BODY_FONT, size: column === 4 ? 13 : 10, bold: column === 4 };
      cell.border = {
        left: column === 0 ? medium : thin,
        right: column === values.length - 1 ? medium : thin,
        bottom: first + index === last ? medium : undefined,
      };
      if (column === 4 || column === 6) cell.numFmt = PESO;
    });
    excelRow.getCell(7).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"CASH,GCASH,MAYA,GOTYME,BANK,OTHER"'],
    };
  });
  sheet.addConditionalFormatting({
    ref: `B${first}:I${last}`,
    rules: [{ type: "expression", priority: 1, formulae: [`$B${first}`], style: { fill: solid(VERIFIED) } }],
  });

  // Side panel: what the day cost and what came in.
  const games = `E${first}:E${last}`;
  const shuttles = report.summary.totalGames / 4;
  const byMethod = (method: string) =>
    rows.filter((row) => row.payment === method).reduce((sum, row) => sum + row.total, 0);
  const methods = ["CASH", "GCASH", "MAYA", "GOTYME", "BANK", "OTHER"].filter(
    (method, index) => index < 4 || byMethod(method) > 0,
  );
  const collected = methods.reduce((sum, method) => sum + byMethod(method), 0);
  const tube = SHUTTLE_TUBE_PRICE;
  const expenses = (tube / 12) * shuttles + report.scheme.split.courtCost;

  sideCell(sheet, "K5", "Base Price", { bold: true });
  sideCell(sheet, "L5", report.scheme.split.flatFee, { bold: true, peso: true, center: true });
  sideCell(sheet, "K6", "Rent", { bold: true });
  sideCell(sheet, "L6", report.scheme.split.courtCost, { bold: true, peso: true, center: true });
  sideCell(sheet, "K7", "Shuttles Used", { bold: true });
  sideCell(sheet, "L7", { formula: `SUM(${games})/4`, result: shuttles }, { bold: true, center: true });
  sideCell(sheet, "K8", "Shuttle Tube Price:", { bold: true });
  sideCell(sheet, "L8", tube, { bold: true, peso: true, center: true });
  sideCell(sheet, "K9", "Total Expenses:", { bold: true });
  sideCell(
    sheet,
    "L9",
    { formula: "((L8/12)*L7)+L6", result: expenses },
    { bold: true, peso: true, center: true },
  );
  const totalRow = 6 + methods.length;
  sideCell(sheet, "K10", "Estimated Revenue:", { bold: true });
  sideCell(
    sheet,
    "L10",
    { formula: `O${totalRow}-L9`, result: collected - expenses },
    { bold: true, peso: true, center: true },
  );

  const methodLabel: Record<string, string> = {
    CASH: "Cash:",
    GCASH: "Gcash:",
    MAYA: "Maya:",
    GOTYME: "GoTyme:",
    BANK: "Bank:",
    OTHER: "Other:",
  };
  methods.forEach((method, index) => {
    sideCell(sheet, `N${6 + index}`, methodLabel[method]);
    sideCell(
      sheet,
      `O${6 + index}`,
      { formula: `SUMIF(G:G,"${method}",F:F)`, result: byMethod(method) },
      { peso: true },
    );
  });
  sideCell(sheet, `N${totalRow}`, "Total:", { bold: true });
  sideCell(
    sheet,
    `O${totalRow}`,
    { formula: `SUM(O6:O${totalRow - 1})`, result: collected },
    { bold: true, peso: true },
  );

  const counts: Array<[string, string]> = [
    ["No. of Active Members:", "Mem"],
    ["No. of Inactive/Alumni :", "Inact/Alum"],
    ["No. of Apps:", "App"],
    ["No. of +1s:", "Plus 1"],
  ];
  const countStart = Math.max(12, totalRow + 2);
  counts.forEach(([label, status], index) => {
    sideCell(sheet, `K${countStart + index}`, label);
    sideCell(
      sheet,
      `L${countStart + index}`,
      { formula: `COUNTIF(C:C,"${status}")`, result: rows.filter((row) => row.status === status).length },
      { center: true },
    );
  });
  const officers: Array<[string, string | null]> = [
    [officerLabel("Queue master", report.gameDay.queueMasterName), report.gameDay.queueMasterName],
    [officerLabel("Finance member", report.gameDay.financeMemberName), report.gameDay.financeMemberName],
  ];
  officers.forEach(([label, name], index) => {
    sideCell(sheet, `K${countStart + counts.length + 1 + index}`, label);
    sideCell(sheet, `L${countStart + counts.length + 1 + index}`, name ?? "", { center: true });
  });
}
