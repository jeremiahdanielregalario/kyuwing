import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GameDaySettings } from "@/components/app/game-day-settings";
import { GameDayTabs } from "@/components/app/game-day-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatGameDate } from "@/lib/datetime";
import { getBoardData, getGameDays, getVenues } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getBoardData(id);
  return { title: data ? `Settings · ${data.gameDay.name}` : "Settings" };
}

export default async function GameDaySettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, venues, allGameDays] = await Promise.all([getBoardData(id), getVenues(), getGameDays()]);
  if (!data) notFound();

  const gameDayRow = allGameDays.find((row) => row.id === id);
  const stats = {
    players: gameDayRow?._count.players ?? data.players.length,
    matches: gameDayRow?._count.matches ?? 0,
  };

  return (
    <>
      <GameDayTabs gameDayId={id} />
      <div className="space-y-5">
        <PageHeader
          eyebrow={`${data.gameDay.venue.shortName} · ${formatGameDate(data.gameDay.date, { weekday: true })}`}
          title="Game-day settings"
          description="Change the schedule, court blocks, and status. The pairing board updates on the next refresh."
          descriptionTrimId="settings.description"
          actions={
            <Link href={`/app/gamedays/${id}`} className={buttonVariants({ variant: "paper", size: "sm" })}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back to board
            </Link>
          }
        />
        <GameDaySettings
          gameDay={data.gameDay}
          venues={venues.map((venue) => ({ id: venue.id, name: venue.name, shortName: venue.shortName }))}
          stats={stats}
          players={data.players}
        />
      </div>
    </>
  );
}
