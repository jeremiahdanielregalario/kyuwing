import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import type { BoardOp } from "@/lib/board-engine/ops";
import { runOps, stateHash } from "@/lib/board-store";
import { refreshAttendance, refreshGameDay } from "@/lib/refresh";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ops: z
    .array(
      z
        .object({
          id: z.string().min(8).max(80),
          at: z.number().finite(),
          type: z.string().min(1).max(40),
        })
        .passthrough(),
    )
    .max(200),
});

/**
 * Saves changes pressed on a device (the board, Fees, Sign-ups), in the order pressed, and
 * answers with what happened to each and the game day as saved. Sending the same changes again
 * is harmless: ones already saved are not applied twice.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Your queue-master session expired. Sign in again." }, { status: 401 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That update could not be read." }, { status: 400 });

  const result = await runOps(id, parsed.data.ops as BoardOp[]);
  if (!result.state) return NextResponse.json({ error: "Game day not found" }, { status: 404 });
  if (parsed.data.ops.length > 0) {
    refreshGameDay(id);
    if (result.closed) refreshAttendance();
  }
  return NextResponse.json(
    { results: result.results, state: result.state, hash: stateHash(result.state), loadedAt: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
