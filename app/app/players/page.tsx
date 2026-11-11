import { Users } from "lucide-react";
import { AwardsPanel } from "@/components/app/awards-panel";
import { PlayerManager } from "@/components/app/player-manager";
import { RecencyPanel } from "@/components/app/recency-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { manilaDateKey } from "@/lib/datetime";
import { LEVELS, bracketOf, isUnrated, levelTone } from "@/lib/levels";
import { getAttendanceOverview, getAwardsOverview, getPlayers } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Players" };

export default async function PlayersPage() {
  const [players, attendance, awards] = await Promise.all([
    getPlayers(),
    getAttendanceOverview(),
    getAwardsOverview(),
  ]);
  const active = players.filter((player) => player.active).length;
  // Band counts describe the active roster; archived players keep their history.
  const activeIds = new Set(players.filter((player) => player.active).map((player) => player.id));
  const activeSnapshots = Object.fromEntries(
    Object.entries(attendance.byPlayer).filter(([playerId]) => activeIds.has(playerId)),
  );
  const alumni = players.filter((player) => player.category === "ALUMNI").length;
  const applicants = players.filter((player) => player.category === "APPLICANT").length;

  const byBracket = ["E", "D", "C", "B", "A"].map((bracket) => ({
    bracket,
    count: players.filter(
      (player) => player.active && !isUnrated(player.level) && bracketOf(player.level) === bracket,
    ).length,
  }));
  const unrated = players.filter((player) => player.active && isUnrated(player.level)).length;
  const maxBracket = Math.max(1, ...byBracket.map((row) => row.count));

  const records = players.map((player) => ({
    id: player.id,
    nickname: player.nickname,
    fullName: player.fullName,
    level: player.level,
    category: player.category,
    contact: player.contact,
    notes: player.notes,
    active: player.active,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Roster & levels"
        title="Players"
        description="The single source of truth for nicknames, levels, and player types. Import a CSV or JSON file, or edit individual players."
        descriptionTrimId="players.description"
      />

      <div data-trim-id="players.stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Active players"
          value={active}
          hint={`${players.length} total in the roster`}
          icon={<Users className="h-4 w-4" />}
          tone="forest"
        />
        <Stat label="Level bands" value="5" hint="E · D · C · B · A" />
        <Stat label="Alumni" value={alumni} hint="Higher fee tier" tone="lime" />
        <Stat label="Applicants" value={applicants} hint="Higher fee tier" />
      </div>

      <div className="border-line bg-paper rounded-3xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold">Bracket spread</h2>
            <p data-trim-id="players.bracket-note" className="text-muted text-[11px]">
              Active players per broad bracket. The pairing engine uses the full 19-level ladder.
            </p>
          </div>
          <span className="text-muted font-mono text-[10px]">
            {LEVELS.length} levels · {active} active
            {unrated > 0 ? ` · ${unrated} not rated yet (X)` : ""}
          </span>
        </div>
        <div className="border-line mt-5 grid grid-cols-5 gap-2 border-b sm:gap-4">
          {byBracket.map((row) => {
            const barPx = row.count === 0 ? 3 : Math.max(12, Math.round((row.count / maxBracket) * 100));
            const tone = levelTone(row.bracket);
            return (
              <div
                key={row.bracket}
                className="flex flex-col items-center justify-end"
                style={{ height: 128 }}
              >
                <span
                  className={cn("mb-1 font-mono text-[12px] leading-none font-bold tabular-nums", tone.text)}
                >
                  {row.count}
                </span>
                <div
                  className={cn("w-full max-w-16 rounded-t-lg transition-all duration-500", tone.solid)}
                  style={{ height: barPx }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2 sm:gap-4">
          {byBracket.map((row) => {
            const tone = levelTone(row.bracket);
            return (
              <div key={row.bracket} className="text-center">
                <span className={cn("font-display text-base font-extrabold", tone.text)}>{row.bracket}</span>
              </div>
            );
          })}
        </div>
      </div>

      <RecencyPanel
        events={attendance.events}
        snapshots={activeSnapshots}
        playerCount={active}
        today={manilaDateKey()}
      />

      <PlayerManager
        players={records}
        recency={attendance.byPlayer}
        history={attendance.historyByPlayer}
        awards={awards.byPlayer}
      />

      <AwardsPanel
        tournaments={awards.tournaments}
        nicknames={players.map((player) => player.nickname)}
        today={manilaDateKey()}
      />

      <p data-trim-id="players.level-legend" className="text-muted text-[11px] leading-relaxed">
        Level labels: {LEVELS.map((level) => level.label).join(" · ")}. X means not rated yet: X players are
        never auto-paired, and the queue board asks for their level before their game starts. Full names are
        optional; nicknames are what the queue board shows. Updating a nickname used on a past game day keeps
        the same player record.
      </p>
    </div>
  );
}
