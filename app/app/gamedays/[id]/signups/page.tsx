import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ClipboardList } from "lucide-react";
import { GameDayTabs } from "@/components/app/game-day-tabs";
import { SignupManager } from "@/components/app/signup-manager";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { levelLabel } from "@/lib/levels";
import { getBoardData, getGameDayBootstrap, getPlayers } from "@/lib/queries";
import { formatGameDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getBoardData(id);
  return { title: data ? `Sign-ups · ${data.gameDay.name}` : "Sign-ups" };
}

export default async function SignupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bootstrap, players] = await Promise.all([getGameDayBootstrap(id), getPlayers()]);
  if (!bootstrap) notFound();
  const { gameDay } = bootstrap.state;
  const expected = bootstrap.state.players.filter((row) => row.status === "EXPECTED").length;

  const database = players.map((player) => ({
    id: player.id,
    nickname: player.nickname,
    fullName: player.fullName,
    level: player.level,
    levelLabel: levelLabel(player.level),
    category: player.category,
  }));

  return (
    <>
      <GameDayTabs gameDayId={id} counts={{ signups: expected }} />
      <div className="space-y-5">
        <PageHeader
          eyebrow={`${gameDay.venue.shortName} · ${formatGameDate(gameDay.date, { weekday: true })}`}
          title="Sign-ups"
          description="Build the list before the session. Check players in only when they arrive — that is when their queue timer starts."
          descriptionTrimId="signups.description"
          actions={
            <>
              <Link href={`/app/gamedays/${id}`} className={buttonVariants({ variant: "paper", size: "sm" })}>
                <ArrowRight className="h-3.5 w-3.5" /> Open board
              </Link>
              <Link href="/app/guide" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <ClipboardList className="h-3.5 w-3.5" /> Playbook
              </Link>
            </>
          }
        />
        <SignupManager bootstrap={bootstrap} database={database} />
      </div>
    </>
  );
}
