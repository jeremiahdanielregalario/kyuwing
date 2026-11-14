import { Users } from "lucide-react";
import { AwardsPanel } from "@/components/app/awards-panel";
import { BracketSpread } from "@/components/app/bracket-spread";
import { PlayerManager } from "@/components/app/player-manager";
import { RecencyPanel } from "@/components/app/recency-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { manilaDateKey } from "@/lib/datetime";
import { LEVELS } from "@/lib/levels";
import { getAttendanceOverview, getAwardsOverview, getPlayers } from "@/lib/queries";

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

  const records = players.map((player) => ({
    id: player.id,
    nickname: player.nickname,
    fullName: player.fullName,
    aliases: player.aliases,
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

      <BracketSpread players={players} />

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
