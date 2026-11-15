import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadEngineState, stateHash } from "@/lib/board-store";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The game day as saved, for a device catching up. With `If-None-Match` set to the fingerprint
 * it already has, an unchanged game day answers 304 with no body, which matters on weak signal.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const state = await loadEngineState(prisma, id);
  if (!state) return NextResponse.json({ error: "Game day not found" }, { status: 404 });

  const hash = stateHash(state);
  const etag = `"${hash}"`;
  const headers = { "Cache-Control": "no-store", ETag: etag };
  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  return NextResponse.json({ state, hash, loadedAt: Date.now() }, { headers });
}
