import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { WORDMARK_PNG_BASE64, WORDMARK_SIZE } from "@/lib/brand-logo";
import { formatClock, formatGameDate } from "@/lib/datetime";
import { CATEGORY_LABELS, GAMEDAY_TYPE_LABELS } from "@/lib/fees";
import { levelLabel } from "@/lib/levels";
import { getFeeReport } from "@/lib/queries";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// UP BadAss colours, matching the app: black, gold, and paper.
const BLACK = "FF0A0A0A";
const GOLD = "FFFFD600";
const PALE_GOLD = "FFFFF8D6";
const MUTED = "FF6E6E64";

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: GOLD }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "thin", color: { argb: GOLD } } };
  });
  row.height = 22;
}

/** Logo in row 1, title (gold underline) in row 2, subtitle in row 3. */
function titleBlock(sheet: ExcelJS.Worksheet, logoId: number, title: string, subtitle: string) {
  sheet.getRow(1).height = 50;
  const logoWidth = 100;
  sheet.addImage(logoId, {
    tl: { col: 0, row: 0 },
    ext: { width: logoWidth, height: (logoWidth * WORDMARK_SIZE.height) / WORDMARK_SIZE.width },
  });
  sheet.mergeCells("A2:F2");
  const cell = sheet.getCell("A2");
  cell.value = title;
  cell.font = { bold: true, size: 18, color: { argb: BLACK } };
  cell.border = { bottom: { style: "medium", color: { argb: GOLD } } };
  sheet.getRow(2).height = 30;
  sheet.mergeCells("A3:F3");
  const sub = sheet.getCell("A3");
  sub.value = subtitle;
  sub.font = { size: 10, color: { argb: MUTED } };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await getFeeReport(id);
  if (!report) return NextResponse.json({ error: "Game day not found" }, { status: 404 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UP Badminton Association";
  const logoId = workbook.addImage({ base64: WORDMARK_PNG_BASE64, extension: "png" });
  workbook.created = new Date();

  const meta = `${report.gameDay.venue.shortName} · ${formatGameDate(report.gameDay.date, { weekday: true })} · ${GAMEDAY_TYPE_LABELS[report.gameDay.type]}`;

  // ---- Summary -------------------------------------------------------------
  const summary = workbook.addWorksheet("Summary", { views: [{ showGridLines: false }] });
  titleBlock(summary, logoId, "UP BadAss Session Report", `${report.gameDay.name} — ${meta}`);
  summary.addRow([]);
  const summaryRows: Array<[string, string | number]> = [
    ["Venue", report.gameDay.venue.name],
    ["Queue master", report.gameDay.queueMasterName ?? "—"],
    ["Finance member", report.gameDay.financeMemberName ?? "—"],
    ["Date", formatGameDate(report.gameDay.date, { weekday: true })],
    ["Game-day type", GAMEDAY_TYPE_LABELS[report.gameDay.type]],
    ["Status", report.gameDay.status],
    ["Players", report.summary.totalPlayers],
    ["Games played", report.matches.filter((match) => !match.free).length],
    ["Free games (not counted)", report.matches.filter((match) => match.free).length],
    ["Player-games", report.summary.totalGames],
    ["Total billed", report.summary.totalBilled],
    ["Total collected", report.summary.totalCollected],
    ["Outstanding", report.summary.totalOutstanding],
    ["Paid players", report.summary.paidPlayers],
    ["Unpaid players", report.summary.unpaidPlayers],
    ["Generated", new Date(report.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })],
  ];
  for (const [label, value] of summaryRows) {
    const row = summary.addRow([label, value]);
    row.getCell(1).font = { bold: true, color: { argb: MUTED }, size: 10 };
    row.getCell(2).font = { size: 10 };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALE_GOLD } };
  }
  summary.getColumn(1).width = 24;
  summary.getColumn(2).width = 48;

  // ---- Players & fees ------------------------------------------------------
  const fees = workbook.addWorksheet("Players & Fees", { views: [{ state: "frozen", ySplit: 5 }] });
  titleBlock(fees, logoId, "Players & Fees", meta);
  fees.addRow([]);
  const feeHeader = fees.addRow([
    "Nickname",
    "Level",
    "Player type",
    "Games",
    "Per game",
    "Extras",
    "Total",
    "Paid",
    "Balance",
    "Change",
    "Status",
    "Settled",
  ]);
  styleHeader(feeHeader);
  for (const row of report.rows) {
    const excelRow = fees.addRow([
      row.nickname,
      levelLabel(row.level),
      CATEGORY_LABELS[row.category],
      row.gamesPlayed,
      row.perGameFee,
      row.extras,
      row.total,
      row.amountPaid,
      row.balance,
      row.change,
      row.paid ? "Paid" : row.amountPaid > 0 ? "Partial" : "Due",
      row.settled ? "Yes" : "",
    ]);
    excelRow.getCell(9).font = row.paid ? { bold: true } : { color: { argb: "FFB53B21" }, bold: true };
  }
  const totalRow = fees.addRow([
    "TOTAL",
    "",
    "",
    report.summary.totalGames,
    "",
    report.rows.reduce((sum, row) => sum + row.extras, 0),
    report.summary.totalBilled,
    report.summary.totalCollected,
    report.summary.totalOutstanding,
    report.rows.reduce((sum, row) => sum + row.change, 0),
    "",
    "",
  ]);
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
  [22, 9, 18, 9, 12, 12, 12, 12, 12, 12, 10, 10].forEach((width, index) => {
    fees.getColumn(index + 1).width = width;
  });

  // ---- Matches -------------------------------------------------------------
  const matches = workbook.addWorksheet("Matches", { views: [{ state: "frozen", ySplit: 5 }] });
  titleBlock(matches, logoId, "Match History", meta);
  matches.addRow([]);
  const matchHeader = matches.addRow([
    "Round",
    "Court",
    "Team A",
    "Team B",
    "Started",
    "Finished",
    "Free game",
  ]);
  styleHeader(matchHeader);
  for (const match of [...report.matches].reverse()) {
    matches.addRow([
      match.round,
      match.courtNumber,
      match.team1.map((player) => `${player.nickname} (${player.levelLabel})`).join(" & "),
      match.team2.map((player) => `${player.nickname} (${player.levelLabel})`).join(" & "),
      match.startedAt ? formatClock(match.startedAt) : "",
      match.endedAt ? formatClock(match.endedAt) : "",
      match.free ? "Yes (not counted)" : "",
    ]);
  }
  [8, 8, 34, 34, 12, 12, 18].forEach((width, index) => {
    matches.getColumn(index + 1).width = width;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${slugify(`${report.gameDay.name}-${report.gameDay.date.slice(0, 10)}`)}-report.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
