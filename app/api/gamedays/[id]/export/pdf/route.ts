import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { WORDMARK_PNG_BASE64, WORDMARK_SIZE } from "@/lib/brand-logo";
import { formatClock, formatGameDate } from "@/lib/datetime";
import { CATEGORY_LABELS, GAMEDAY_TYPE_LABELS, formatPesoPdf } from "@/lib/fees";
import { levelLabel } from "@/lib/levels";
import { getFeeReport } from "@/lib/queries";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// UP BadAss colours, matching the app: black, gold, and paper.
const BLACK = rgb(10 / 255, 10 / 255, 10 / 255);
const GOLD = rgb(1, 214 / 255, 0);
const PALE_GOLD = rgb(1, 248 / 255, 214 / 255);
const PAPER = rgb(251 / 255, 250 / 255, 245 / 255);
const INK = rgb(10 / 255, 10 / 255, 10 / 255);
const MUTED = rgb(110 / 255, 110 / 255, 100 / 255);
const LINE = rgb(225 / 255, 220 / 255, 200 / 255);
const WHITE = rgb(1, 1, 1);
const HERO_GREY = rgb(0.75, 0.75, 0.72);

type Column = {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await getFeeReport(id);
  if (!report) return NextResponse.json({ error: "Game day not found" }, { status: 404 });

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(WORDMARK_PNG_BASE64, "base64"));

  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const meta = `${report.gameDay.venue.shortName} · ${formatGameDate(report.gameDay.date, { weekday: true })} · ${GAMEDAY_TYPE_LABELS[report.gameDay.type]}`;
  const officers = [
    { label: "QUEUE MASTER", name: report.gameDay.queueMasterName ?? "—" },
    { label: "FINANCE MEMBER", name: report.gameDay.financeMemberName ?? "—" },
  ];
  const generated = new Date(report.generatedAt).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const drawPageFrame = (withHero = true) => {
    if (withHero) {
      const heroHeight = 112;
      page.drawRectangle({
        x: 0,
        y: pageHeight - heroHeight,
        width: pageWidth,
        height: heroHeight,
        color: BLACK,
      });
      page.drawRectangle({ x: 0, y: pageHeight - heroHeight - 3, width: pageWidth, height: 3, color: GOLD });

      // Logo on a white tile, like the app sidebar.
      const tile = { x: margin, y: pageHeight - 94, width: 104, height: 70 };
      page.drawRectangle({ ...tile, color: WHITE });
      const logoWidth = 90;
      const logoHeight = (logoWidth * WORDMARK_SIZE.height) / WORDMARK_SIZE.width;
      page.drawImage(logo, {
        x: tile.x + (tile.width - logoWidth) / 2,
        y: tile.y + (tile.height - logoHeight) / 2,
        width: logoWidth,
        height: logoHeight,
      });

      const textX = tile.x + tile.width + 18;
      text("SESSION REPORT", textX, pageHeight - 40, 9, bold, GOLD);
      text(report.gameDay.name, textX, pageHeight - 64, 18, bold, WHITE, 380);
      text(meta, textX, pageHeight - 84, 9, regular, HERO_GREY, 380);

      // Officers on duty, right-aligned.
      officers.forEach((officer, index) => {
        const top = pageHeight - 40 - index * 30;
        const nameWidth = Math.min(bold.widthOfTextAtSize(officer.name, 11), 200);
        page.drawText(officer.label, {
          x: pageWidth - margin - bold.widthOfTextAtSize(officer.label, 7),
          y: top,
          size: 7,
          font: bold,
          color: GOLD,
        });
        text(officer.name, pageWidth - margin - nameWidth, top - 14, 11, bold, WHITE, 200);
      });
      y = pageHeight - 140;
    } else {
      page.drawText("UP BadAss · Session report", {
        x: margin,
        y: pageHeight - 34,
        size: 8,
        font: regular,
        color: MUTED,
      });
      page.drawText(meta, {
        x: pageWidth - margin - regular.widthOfTextAtSize(meta, 8),
        y: pageHeight - 34,
        size: 8,
        font: regular,
        color: MUTED,
      });
      page.drawLine({
        start: { x: margin, y: pageHeight - 42 },
        end: { x: pageWidth - margin, y: pageHeight - 42 },
        thickness: 0.5,
        color: LINE,
      });
      y = pageHeight - 60;
    }
  };

  const newPage = (withHero = false) => {
    page = pdf.addPage([pageWidth, pageHeight]);
    drawPageFrame(withHero);
  };

  const ensure = (height: number) => {
    if (y - height < margin + 10) newPage(false);
  };

  const text = (
    value: string,
    x: number,
    yPos: number,
    size = 9,
    font = regular,
    color = INK,
    maxWidth?: number,
  ) => {
    let output = value;
    if (maxWidth && font.widthOfTextAtSize(output, size) > maxWidth) {
      while (output.length > 1 && font.widthOfTextAtSize(`${output}…`, size) > maxWidth)
        output = output.slice(0, -1);
      output = `${output}…`;
    }
    page.drawText(output, { x, y: yPos, size, font, color });
  };

  const sectionTitle = (title: string) => {
    ensure(28);
    text(title.toUpperCase(), margin, y, 8, bold, MUTED);
    y -= 14;
  };

  // Tables span the full content width, keeping their relative column widths.
  const fit = (columns: Column[]): Column[] => {
    const total = columns.reduce((sum, column) => sum + column.width, 0);
    return columns.map((column) => ({ ...column, width: (column.width * contentWidth) / total }));
  };

  const tableHeader = (columns: Column[], startX = margin) => {
    ensure(24);
    page.drawRectangle({
      x: startX,
      y: y - 16,
      width: columns.reduce((sum, c) => sum + c.width, 0),
      height: 20,
      color: BLACK,
    });
    let x = startX;
    for (const column of columns) {
      const offset =
        column.align === "right"
          ? column.width - regular.widthOfTextAtSize(column.label, 7) - 8
          : column.align === "center"
            ? (column.width - regular.widthOfTextAtSize(column.label, 7)) / 2
            : 8;
      text(column.label.toUpperCase(), x + offset, y - 10, 7, bold, GOLD);
      x += column.width;
    }
    y -= 20;
  };

  const tableRow = (
    columns: Column[],
    values: string[],
    startX = margin,
    options: { bold?: boolean; fill?: boolean; highlight?: boolean; color?: typeof INK } = {},
  ) => {
    ensure(20);
    if (options.fill || options.highlight) {
      page.drawRectangle({
        x: startX,
        y: y - 16,
        width: columns.reduce((sum, c) => sum + c.width, 0),
        height: 19,
        color: options.highlight ? GOLD : PALE_GOLD,
      });
    }
    let x = startX;
    columns.forEach((column, index) => {
      const value = values[index] ?? "";
      const font = options.bold ? bold : regular;
      const offset =
        column.align === "right"
          ? column.width - font.widthOfTextAtSize(value, 8) - 8
          : column.align === "center"
            ? (column.width - font.widthOfTextAtSize(value, 8)) / 2
            : 8;
      text(value, x + Math.max(2, offset), y - 10, 8, font, options.color ?? INK, column.width - 12);
      x += column.width;
    });
    page.drawLine({
      start: { x: startX, y: y - 17 },
      end: { x: startX + columns.reduce((sum, c) => sum + c.width, 0), y: y - 17 },
      thickness: 0.4,
      color: LINE,
    });
    y -= 19;
  };

  drawPageFrame(true);

  // Summary cards
  const cards = [
    { label: "Players", value: String(report.summary.totalPlayers) },
    { label: "Games", value: String(report.matches.filter((match) => !match.free).length) },
    { label: "Billed", value: formatPesoPdf(report.summary.totalBilled) },
    { label: "Collected", value: formatPesoPdf(report.summary.totalCollected) },
    { label: "Outstanding", value: formatPesoPdf(report.summary.totalOutstanding) },
  ];
  const cardWidth = (contentWidth - 8 * 4) / 5;
  cards.forEach((card, index) => {
    const x = margin + index * (cardWidth + 8);
    page.drawRectangle({
      x,
      y: y - 44,
      width: cardWidth,
      height: 44,
      color: index === 4 ? GOLD : PAPER,
      borderColor: LINE,
      borderWidth: 0.5,
    });
    text(card.label.toUpperCase(), x + 8, y - 14, 6.5, bold, index === 4 ? BLACK : MUTED);
    text(card.value, x + 8, y - 32, 12, bold, BLACK);
  });
  y -= 64;

  // Fees
  sectionTitle("Players & fees");
  const feeColumns: Column[] = fit([
    { label: "Player", width: 110 },
    { label: "Level", width: 40 },
    { label: "Type", width: 76 },
    { label: "Games", width: 40, align: "center" },
    { label: "Per game", width: 50, align: "right" },
    { label: "Extras", width: 48, align: "right" },
    { label: "Total", width: 55, align: "right" },
    { label: "Paid", width: 52, align: "right" },
    { label: "Balance", width: 54, align: "right" },
    { label: "Change", width: 50, align: "right" },
    { label: "Status", width: 56, align: "center" },
  ]);
  tableHeader(feeColumns);
  report.rows.forEach((row, index) => {
    tableRow(
      feeColumns,
      [
        row.nickname,
        levelLabel(row.level),
        CATEGORY_LABELS[row.category],
        String(row.gamesPlayed),
        formatPesoPdf(row.perGameFee),
        row.extras ? formatPesoPdf(row.extras) : "-",
        formatPesoPdf(row.total),
        formatPesoPdf(row.amountPaid),
        formatPesoPdf(row.balance),
        row.change ? formatPesoPdf(row.change) : "-",
        row.settled ? "Settled" : row.paid ? "Paid" : row.amountPaid > 0 ? "Partial" : "Due",
      ],
      margin,
      { fill: index % 2 === 1, bold: !row.paid },
    );
  });
  tableRow(
    feeColumns,
    [
      "TOTAL",
      "",
      "",
      String(report.summary.totalGames),
      "",
      formatPesoPdf(report.rows.reduce((sum, row) => sum + row.extras, 0)),
      formatPesoPdf(report.summary.totalBilled),
      formatPesoPdf(report.summary.totalCollected),
      formatPesoPdf(report.summary.totalOutstanding),
      "",
      "",
    ],
    margin,
    { bold: true, highlight: true },
  );

  y -= 14;

  // Matches
  sectionTitle("Match history");
  const matchColumns: Column[] = fit([
    { label: "R", width: 24, align: "center" },
    { label: "Court", width: 40, align: "center" },
    { label: "Team A", width: 240 },
    { label: "Team B", width: 240 },
    { label: "Finished", width: 60, align: "right" },
  ]);
  tableHeader(matchColumns);
  [...report.matches].reverse().forEach((match, index) => {
    tableRow(
      matchColumns,
      [
        String(match.round),
        match.free ? `C${match.courtNumber} free` : `C${match.courtNumber}`,
        match.team1.map((player) => `${player.nickname} (${player.levelLabel})`).join(" & "),
        match.team2.map((player) => `${player.nickname} (${player.levelLabel})`).join(" & "),
        match.endedAt ? formatClock(match.endedAt) : "",
      ],
      margin,
      { fill: index % 2 === 1 },
    );
  });

  // Footer on every page
  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawLine({
      start: { x: margin, y: 28 },
      end: { x: pageWidth - margin, y: 28 },
      thickness: 0.5,
      color: LINE,
    });
    current.drawText(`UP Badminton Association · Diliman · Generated ${generated}`, {
      x: margin,
      y: 16,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    current.drawText(pageLabel, {
      x: pageWidth - margin - regular.widthOfTextAtSize(pageLabel, 7.5),
      y: 16,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
  });

  const bytes = await pdf.save();
  const filename = `${slugify(`${report.gameDay.name}-${report.gameDay.date.slice(0, 10)}`)}-report.pdf`;

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
