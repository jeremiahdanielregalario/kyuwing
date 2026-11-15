import { notFound } from "next/navigation";
import { GameDayTabs } from "@/components/app/game-day-tabs";
import { QueueBoard } from "@/components/app/queue-board";
import { toBoardData } from "@/lib/board-engine/view";
import { getBoardData, getGameDayBootstrap } from "@/lib/queries";
import { liveViewPath } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getBoardData(id);
  return { title: data ? data.gameDay.name : "Game day" };
}

export default async function GameDayBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { id } = await params;
  const { slot } = await searchParams;
  const slotIndex = slot !== undefined ? Number(slot) : null;
  const initialSlot = Number.isFinite(slotIndex as number) ? slotIndex : null;
  const bootstrap = await getGameDayBootstrap(id);
  if (!bootstrap) notFound();
  const data = toBoardData(bootstrap.state, { slot: initialSlot, now: bootstrap.loadedAt });

  return (
    <>
      <GameDayTabs gameDayId={id} counts={{ signups: data.stats.expected }} />
      <QueueBoard bootstrap={bootstrap} initialSlot={initialSlot} livePath={liveViewPath(id)} />
    </>
  );
}
