import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { CATEGORY_LABELS } from "@/lib/fees";
import { getPlayers } from "@/lib/queries";
import { levelLabel } from "@/lib/levels";

export const dynamic = "force-dynamic";

function csvEscape(value: string | null | undefined) {
  const input = value ?? "";
  if (/[",\n]/.test(input)) return `"${input.replace(/"/g, '""')}"`;
  return input;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const template = url.searchParams.get("template") === "1";
  const header = ["nickname", "fullName", "level", "category", "contact", "notes"];

  if (template) {
    const body = `\uFEFF${header.join(",")}\n`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="kyuwing-players-template.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  const players = await getPlayers();
  const lines = [header.join(",")];
  for (const player of players) {
    lines.push(
      [
        csvEscape(player.nickname),
        csvEscape(player.fullName),
        levelLabel(player.level),
        CATEGORY_LABELS[player.category],
        csvEscape(player.contact),
        csvEscape(player.notes),
      ].join(","),
    );
  }

  return new NextResponse(`\uFEFF${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kyuwing-players.csv"',
      "Cache-Control": "no-store",
    },
  });
}
