import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { takeOverBoard } from "@/lib/board-store";
import { currentClaimant } from "@/lib/device";

export const dynamic = "force-dynamic";

/**
 * Takes a game day's board over from a device that is out of touch (lib/board-lease.ts). Changes
 * that device made before now are refused when it reconnects. Answers with the lease.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Your queue-master session expired. Sign in again." }, { status: 401 });

  const { id } = await params;
  const lease = await takeOverBoard(id, await currentClaimant());
  if (!lease) return NextResponse.json({ error: "Game day not found" }, { status: 404 });
  return NextResponse.json({ lease }, { headers: { "Cache-Control": "no-store" } });
}
