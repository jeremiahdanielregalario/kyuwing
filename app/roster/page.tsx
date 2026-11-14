import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { AwardsPanel } from "@/components/app/awards-panel";
import { BracketSpread } from "@/components/app/bracket-spread";
import { PlayerManager } from "@/components/app/player-manager";
import { RecencyPanel } from "@/components/app/recency-panel";
import { Logo } from "@/components/logo";
import { Stat } from "@/components/ui/stat";
import { manilaDateKey } from "@/lib/datetime";
import { getPublicRoster } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Player roster",
  description: "The UP BadAss roster: nicknames, levels, playing recency and tournament awards.",
  // Full names are shown, so keep the page out of search results.
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ back?: string | string[] }> };

/** Only links back into a live view, so the parameter can't send people elsewhere. */
function backLink(value: string | string[] | undefined): string | null {
  const path = Array.isArray(value) ? value[0] : value;
  return path && /^\/live\/[\w-]+\/[\w-]+$/.test(path) ? path : null;
}

export default async function PublicRosterPage({ searchParams }: Props) {
  const back = backLink((await searchParams).back);
  const roster = await getPublicRoster();
  const players = roster.players.map((player) => ({
    ...player,
    contact: null,
    notes: null,
    active: true,
  }));
  const count = (category: string) => players.filter((player) => player.category === category).length;

  return (
    <div className="min-h-dvh pb-12">
      <header className="bg-forest-deep text-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Kyuwing home">
            <Logo compact tone="cream" />
          </Link>
          {back ? (
            <Link
              href={back}
              className="press border-lime/30 bg-lime/10 text-lime inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[12px] font-bold"
            >
              <ArrowLeft className="h-4 w-4" /> Back to the live queue
            </Link>
          ) : (
            <Link
              href="/"
              className="press border-cream/20 text-cream/80 hover:text-cream inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[12px] font-semibold"
            >
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          )}
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
          <p className="text-lime text-[10px] font-bold tracking-[0.18em] uppercase">UP BadAss · View only</p>
          <h1 className="font-display mt-1 text-3xl leading-tight font-extrabold">Player roster</h1>
          <p className="text-cream/60 mt-2 max-w-2xl text-[13px] leading-relaxed">
            Everyone on the active roster with their level, how often they have been playing, and their
            tournament podiums. Tap the clock icon for a player&apos;s attendance, or the trophy for their
            awards.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 pt-6 sm:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Active players"
            value={players.length}
            hint="On the roster"
            icon={<Users className="h-4 w-4" />}
            tone="forest"
          />
          <Stat label="Level bands" value="5" hint="E · D · C · B · A" />
          <Stat label="Alumni" value={count("ALUMNI")} hint="UP BadAss alumni" tone="lime" />
          <Stat label="Applicants" value={count("APPLICANT")} hint="Applying to join" />
        </div>

        <BracketSpread players={players} />

        <PlayerManager
          readOnly
          players={players}
          recency={roster.recency}
          history={roster.history}
          awards={roster.awards}
        />

        <RecencyPanel
          readOnly
          events={roster.events}
          snapshots={roster.recency}
          playerCount={players.length}
          today={manilaDateKey()}
        />

        <AwardsPanel readOnly tournaments={roster.tournaments} nicknames={[]} today={manilaDateKey()} />

        <p className="text-muted text-center text-[11px]">View only · App by Danyel Regalario</p>
      </main>
    </div>
  );
}
