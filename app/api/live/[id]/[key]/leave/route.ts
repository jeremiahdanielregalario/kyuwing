import { NextResponse } from "next/server";
import { createLeaveRequest } from "@/lib/leave-requests";
import { verifyLiveViewKey } from "@/lib/share";

export const dynamic = "force-dynamic";

/**
 * Public: a player on the shared live link asks to be taken out of the game
 * day. Needs the link's key and an official nickname; the queue master still
 * has to confirm, so a request on its own changes nothing on the board.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  if (!verifyLiveViewKey(id, key))
    return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

  let nickname = "";
  try {
    const body = (await request.json()) as { nickname?: unknown };
    nickname = typeof body.nickname === "string" ? body.nickname.slice(0, 40) : "";
  } catch {
    return NextResponse.json({ ok: false, message: "Type your official nickname first." }, { status: 400 });
  }

  const result = await createLeaveRequest(id, nickname);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
