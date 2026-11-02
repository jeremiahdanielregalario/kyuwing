import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBoardData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const url = new URL(request.url);
  const slotParam = url.searchParams.get("slot");
  const slot = slotParam === null || slotParam === "" ? null : Number(slotParam);
  const data = await getBoardData(id, Number.isFinite(slot) ? slot : null);
  if (!data) return NextResponse.json({ error: "Game day not found" }, { status: 404 });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
