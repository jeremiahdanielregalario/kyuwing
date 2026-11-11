import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveView } from "@/components/live/live-view";
import { getPublicBoard } from "@/lib/public-board-data";
import { getBoardData } from "@/lib/queries";
import { verifyLiveViewKey } from "@/lib/share";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; key: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, key } = await params;
  const data = verifyLiveViewKey(id, key) ? await getBoardData(id) : null;
  return {
    title: data ? `${data.gameDay.name} · Live queue` : "Live queue",
    robots: { index: false, follow: false },
  };
}

export default async function LiveViewPage({ params }: Params) {
  const { id, key } = await params;
  if (!verifyLiveViewKey(id, key)) notFound();
  const board = await getPublicBoard(id);
  if (!board) notFound();

  return (
    <LiveView
      initialData={board}
      endpoint={`/api/live/${id}/${key}`}
      rosterHref={`/roster?back=${encodeURIComponent(`/live/${id}/${key}`)}`}
    />
  );
}
