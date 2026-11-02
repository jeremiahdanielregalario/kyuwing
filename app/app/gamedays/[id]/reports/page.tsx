import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileSpreadsheet, FileText, Trophy, Users } from "lucide-react";
import { GameDayTabs } from "@/components/app/game-day-tabs";
import { PrintButton } from "@/components/app/print-button";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { LevelBadge } from "@/components/ui/level-badge";
import { formatClock, formatGameDate } from "@/lib/datetime";
import { GAMEDAY_TYPE_LABELS, formatPeso } from "@/lib/fees";
import { getFeeReport } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getFeeReport(id);
  return { title: report ? `Reports · ${report.gameDay.name}` : "Reports" };
}

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getFeeReport(id);
  if (!report) notFound();

  const leaderboard = [...report.rows].sort(
    (a, b) => b.gamesPlayed - a.gamesPlayed || a.nickname.localeCompare(b.nickname),
  );
  const matches = report.matches;

  return (
    <>
      <GameDayTabs gameDayId={id} />
      <div className="space-y-5">
        <PageHeader
          eyebrow={`${report.gameDay.venue.shortName} · ${formatGameDate(report.gameDay.date, { weekday: true })} · ${GAMEDAY_TYPE_LABELS[report.gameDay.type]}`}
          title="Session report"
          description="The full day in one place: every match, every player, every peso. Export it for the group chat or the treasurer."
          actions={
            <>
              <PrintButton label="Print" />
              <a href={`/api/gamedays/${id}/export/xlsx`}>
                <Button variant="paper" size="sm">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </Button>
              </a>
              <a href={`/api/gamedays/${id}/export/pdf`}>
                <Button variant="primary" size="sm">
                  <FileText className="h-3.5 w-3.5" /> PDF
                </Button>
              </a>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Games played"
            value={report.matches.length}
            hint={`${report.summary.totalGames} player-games`}
            icon={<Trophy className="h-4 w-4" />}
            tone="forest"
          />
          <Stat
            label="Players"
            value={report.summary.totalPlayers}
            hint={`${report.summary.paidPlayers} settled`}
            icon={<Users className="h-4 w-4" />}
          />
          <Stat
            label="Total billed"
            value={formatPeso(report.summary.totalBilled)}
            hint={`${formatPeso(report.summary.totalCollected)} collected`}
            tone="lime"
          />
          <Stat
            label="Outstanding"
            value={formatPeso(report.summary.totalOutstanding)}
            hint={`${report.summary.unpaidPlayers} players to follow up`}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <Card className="overflow-hidden">
            <div className="border-line/80 flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="font-display text-base font-bold">Match history</h2>
                <p className="text-muted text-[11px]">{matches.length} completed matches · newest first</p>
              </div>
              <Download className="text-muted h-4 w-4" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-[12px]">
                <thead>
                  <tr className="border-line bg-cream/50 text-muted border-b text-[9px] tracking-[0.12em] uppercase">
                    <th className="px-4 py-2.5 font-bold">Court</th>
                    <th className="px-2 py-2.5 font-bold">Team A</th>
                    <th className="px-2 py-2.5 font-bold">Team B</th>
                    <th className="px-4 py-2.5 text-right font-bold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-muted px-4 py-12 text-center">
                        No completed matches yet.
                      </td>
                    </tr>
                  ) : (
                    matches.map((match) => {
                      return (
                        <tr key={match.id} className="border-line/50 border-b">
                          <td className="px-4 py-2.5">
                            <span className="text-muted font-mono text-[11px] font-bold">
                              C{match.courtNumber}
                            </span>
                            <span className="text-muted ml-2 text-[9px]">R{match.round}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              {match.team1.map((player) => (
                                <span key={player.playerId} className="inline-flex items-center gap-1">
                                  <span className="font-semibold">{player.nickname}</span>
                                  <LevelBadge level={player.level} className="px-1 text-[9px]" />
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              {match.team2.map((player) => (
                                <span key={player.playerId} className="inline-flex items-center gap-1">
                                  <span className="font-semibold">{player.nickname}</span>
                                  <LevelBadge level={player.level} className="px-1 text-[9px]" />
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="text-muted px-4 py-2.5 text-right text-[10px]">
                            {match.endedAt ? formatClock(match.endedAt) : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="overflow-hidden">
              <div className="border-line/80 border-b px-4 py-3">
                <h2 className="font-display text-base font-bold">Player leaderboard</h2>
                <p className="text-muted text-[11px]">Most games first.</p>
              </div>
              <div className="divide-line/50 divide-y">
                {leaderboard.slice(0, 10).map((row, index) => (
                  <div key={row.sessionPlayerId} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="text-muted w-4 font-mono text-[10px] font-bold">{index + 1}</span>
                    <LevelBadge level={row.level} />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{row.nickname}</span>
                    <span className="text-muted font-mono text-[10px]">{row.gamesPlayed} games</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="font-display text-base font-bold">Settlement snapshot</h2>
              <div className="mt-3 space-y-2 text-[12px]">
                <Row label="Billed" value={formatPeso(report.summary.totalBilled)} />
                <Row label="Collected" value={formatPeso(report.summary.totalCollected)} />
                <Row label="Outstanding" value={formatPeso(report.summary.totalOutstanding)} accent />
                <Row
                  label="Paid players"
                  value={`${report.summary.paidPlayers} / ${report.summary.totalPlayers}`}
                />
                <Row label="Games logged" value={String(report.summary.totalGames)} />
              </div>
              <div className="mt-4 flex gap-2">
                <a href={`/api/gamedays/${id}/export/xlsx`} className="flex-1">
                  <Button variant="paper" size="sm" className="w-full">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                  </Button>
                </a>
                <a href={`/api/gamedays/${id}/export/pdf`} className="flex-1">
                  <Button variant="primary" size="sm" className="w-full">
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </Button>
                </a>
              </div>
              <p className="text-muted mt-3 text-[10px] leading-relaxed">
                Generated {new Date(report.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}.
                Exports include the fee ledger and every match.
              </p>
            </Card>
          </div>
        </div>

        <div className="no-print border-line bg-paper/60 text-muted flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-[11px]">
          <span>Need the full fee detail? The Excel workbook includes one row per player and per match.</span>
          <Link href={`/app/gamedays/${id}/fees`} className="text-forest font-semibold hover:underline">
            Open fee ledger
          </Link>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border-line/40 flex items-center justify-between gap-2 border-b pb-1.5 last:border-0">
      <span className="text-muted">{label}</span>
      <span className={accent ? "text-coral font-mono font-bold" : "font-mono font-bold"}>{value}</span>
    </div>
  );
}
