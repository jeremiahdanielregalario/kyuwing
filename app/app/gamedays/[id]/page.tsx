import { notFound } from "next/navigation";
import { GameDayTabs } from "@/components/app/game-day-tabs";
import { QueueBoard } from "@/components/app/queue-board";
import { getBoardData } from "@/lib/queries";

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
  const data = await getBoardData(id, Number.isFinite(slotIndex as number) ? slotIndex : null);
  if (!data) notFound();

  return (
    <>
      <GameDayTabs gameDayId={id} counts={{ signups: data.stats.expected }} />
      <QueueBoard initialData={data} />
    </>
  );
}
