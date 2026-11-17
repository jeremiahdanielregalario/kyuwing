import { NextResponse } from "next/server";
import { getPublicFeeSheet } from "@/lib/public-fees-data";
import { verifyFeesViewKey } from "@/lib/share";

export const dynamic = "force-dynamic";

/** Public, view-only fees polling for the finance member's shared link. No session required. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  if (!verifyFeesViewKey(id, key)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sheet = await getPublicFeeSheet(id);
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(sheet, { headers: { "Cache-Control": "no-store" } });
}
