import { NextResponse } from "next/server";
import { toPublicBoard } from "@/lib/public-board";
import { getBoardData } from "@/lib/queries";
import { verifyLiveViewKey } from "@/lib/share";

export const dynamic = "force-dynamic";

/** Public, view-only board polling for shared live links. No session required. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  if (!verifyLiveViewKey(id, key)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = await getBoardData(id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(toPublicBoard(data), { headers: { "Cache-Control": "no-store" } });
}
