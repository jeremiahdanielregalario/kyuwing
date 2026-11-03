import { Users } from "lucide-react";
import { PlayerManager } from "@/components/app/player-manager";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { BRACKET_LABELS, LEVELS, bracketOf } from "@/lib/levels";
import { getPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Players" };

export default async function PlayersPage() {
  const players = await getPlayers();
  const active = players.filter((player) => player.active).length;
  const alumni = players.filter((player) => player.category === "ALUMNI").length;
  const applicants = players.filter((player) => player.category === "APPLICANT").length;

  const byBracket = ["E", "D", "C", "B", "A"].map((bracket) => ({
    bracket,
    count: players.filter((player) => player.active && bracketOf(player.level) === bracket).length,
  }));
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
          label="Total players"
          value={players.length}
          hint={`${active} active in the roster`}
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
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {byBracket.map((row) => (
            <div key={row.bracket} className="flex items-center gap-3 sm:flex-col sm:items-start">
              <div className="flex w-16 items-baseline gap-1.5 sm:w-auto">
                <span className="font-display text-xl font-extrabold">{row.bracket}</span>
                <span className="text-muted text-[10px]">
                  {BRACKET_LABELS[row.bracket as keyof typeof BRACKET_LABELS]}
                </span>
              </div>
              <div className="bg-cream-deep h-2 flex-1 overflow-hidden rounded-full sm:w-full">
                <div
                  className="bg-forest h-full rounded-full"
                  style={{ width: `${(row.count / maxBracket) * 100}%` }}
                />
              </div>
              <span className="text-ink-soft font-mono text-[11px] font-bold sm:text-[10px]">
                {row.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <PlayerManager players={records} />

      <p data-trim-id="players.level-legend" className="text-muted text-[11px] leading-relaxed">
        Level labels: {LEVELS.map((level) => level.label).join(" · ")}. Full names are optional; nicknames are
        what the queue board shows. Updating a nickname used on a past game day keeps the same player record.
      </p>
    </div>
  );
}
