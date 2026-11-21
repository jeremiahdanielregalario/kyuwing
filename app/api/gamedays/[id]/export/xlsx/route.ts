import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { WORDMARK_PNG_BASE64 } from "@/lib/brand-logo";
import { formatClock, formatGameDate } from "@/lib/datetime";
import {
  AMBER,
  BODY_FONT,
  HEADER,
  STRIPE,
  TITLE_FONT,
  WHITE,
  addFinanceTracker,
  boxed,
  medium,
  solid,
  thin,
} from "@/lib/finance-tracker-xlsx";
import { playerMatchesReport } from "@/lib/player-matches-report";
import { getFeeReport } from "@/lib/queries";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  addFinanceTracker(workbook, report, logoId);

  // ---- Matches, in the same style ------------------------------------------
  const matches = workbook.addWorksheet("Matches", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
  });
  [1.75, 8, 8, 34, 34, 12, 12, 18].forEach((width, index) => {
    matches.getColumn(index + 1).width = width;
  });
  matches.getRow(1).height = 7.5;
  matches.mergeCells("B2:H2");
  const title = matches.getCell("B2");
  title.value = `Match History · ${report.gameDay.venue.shortName} · ${formatGameDate(report.gameDay.date, { weekday: true })}`;
  title.font = { name: TITLE_FONT, bold: true, size: 18 };
  title.fill = solid(AMBER);
  title.border = boxed;
  title.alignment = { horizontal: "center", vertical: "middle" };
  matches.getRow(2).height = 33;
  const matchHeader = matches.getRow(3);
  ["Round", "Court", "Team A", "Team B", "Started", "Finished", "Free game"].forEach((label, index) => {
    const cell = matchHeader.getCell(index + 2);
    cell.value = label;
    cell.font = { name: BODY_FONT, bold: true, size: 10 };
    cell.fill = solid(HEADER);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: medium,
      bottom: medium,
      left: index === 0 ? medium : thin,
      right: index === 6 ? medium : thin,
    };
  });
  matchHeader.height = 24;
  [...report.matches].reverse().forEach((match, index, all) => {
    const row = matches.getRow(4 + index);
    row.height = 20;
    const values = [
      match.round,
      match.courtNumber,
      match.team1.map((player) => `${player.nickname} (${player.levelLabel})`).join(" & "),
      match.team2.map((player) => `${player.nickname} (${player.levelLabel})`).join(" & "),
      match.startedAt ? formatClock(match.startedAt) : "",
      match.endedAt ? formatClock(match.endedAt) : "",
      match.free ? "Yes (not counted)" : "",
    ];
    values.forEach((value, column) => {
      const cell = row.getCell(column + 2);
      cell.value = value;
      cell.font = { name: BODY_FONT, size: 10 };
      cell.fill = solid(index % 2 === 1 ? STRIPE : WHITE);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        left: column === 0 ? medium : thin,
        right: column === values.length - 1 ? medium : thin,
        bottom: index === all.length - 1 ? medium : undefined,
      };
    });
  });

  // ---- Matches per player ---------------------------------------------------
  const perPlayer = workbook.addWorksheet("Matches per player", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
  });
  const perPlayerHeaders = [
    "Player",
    "Game",
    "Round",
    "Court",
    "Partner",
    "Opponents",
    "Started",
    "Finished",
    "Free game",
  ];
  [1.75, 24, 7, 7, 7, 20, 34, 11, 11, 18].forEach((width, index) => {
    perPlayer.getColumn(index + 1).width = width;
  });
  perPlayer.getRow(1).height = 7.5;
  perPlayer.mergeCells("B2:J2");
  const perPlayerTitle = perPlayer.getCell("B2");
  perPlayerTitle.value = `Matches per Player · ${report.gameDay.venue.shortName} · ${formatGameDate(report.gameDay.date, { weekday: true })}`;
  perPlayerTitle.font = { name: TITLE_FONT, bold: true, size: 18 };
  perPlayerTitle.fill = solid(AMBER);
  perPlayerTitle.border = boxed;
  perPlayerTitle.alignment = { horizontal: "center", vertical: "middle" };
  perPlayer.getRow(2).height = 33;
  const perPlayerHeader = perPlayer.getRow(3);
  perPlayerHeaders.forEach((label, index) => {
    const cell = perPlayerHeader.getCell(index + 2);
    cell.value = label;
    cell.font = { name: BODY_FONT, bold: true, size: 10 };
    cell.fill = solid(HEADER);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: medium,
      bottom: medium,
      left: index === 0 ? medium : thin,
      right: index === perPlayerHeaders.length - 1 ? medium : thin,
    };
  });
  perPlayerHeader.height = 24;

  const blocks = playerMatchesReport(report);
  let rowNumber = 4;
  blocks.forEach((block, blockIndex) => {
    const fill = solid(blockIndex % 2 === 1 ? STRIPE : WHITE);
    const lastBlock = blockIndex === blocks.length - 1;
    const games = `${block.gamesPlayed} game${block.gamesPlayed === 1 ? "" : "s"}`;
    const lines = block.lines.length > 0 ? block.lines : [null];
    const firstRow = rowNumber;
    lines.forEach((line, lineIndex) => {
      const row = perPlayer.getRow(rowNumber);
      row.height = 20;
      const values = line
        ? [
            lineIndex === 0 ? `${block.nickname} (${block.levelLabel}) · ${games}` : "",
            line.number,
            line.round,
            line.courtNumber,
            line.partner,
            line.opponents,
            line.startedAt ? formatClock(line.startedAt) : "",
            line.endedAt ? formatClock(line.endedAt) : "",
            line.free ? "Yes (not counted)" : "",
          ]
        : [`${block.nickname} (${block.levelLabel}) · ${games}`, "No games", "", "", "", "", "", "", ""];
      const lastLine = lineIndex === lines.length - 1;
      values.forEach((value, column) => {
        const cell = row.getCell(column + 2);
        cell.value = value;
        cell.font = { name: BODY_FONT, size: 10, bold: column === 0 };
        cell.fill = fill;
        cell.alignment = {
          horizontal: column === 0 ? "left" : "center",
          vertical: "middle",
          indent: column === 0 ? 1 : 0,
        };
        cell.border = {
          top: lineIndex === 0 ? thin : undefined,
          left: column === 0 ? medium : thin,
          right: column === values.length - 1 ? medium : thin,
          bottom: lastLine ? (lastBlock ? medium : thin) : undefined,
        };
      });
      rowNumber += 1;
    });
    if (lines.length > 1) perPlayer.mergeCells(firstRow, 2, rowNumber - 1, 2);
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
