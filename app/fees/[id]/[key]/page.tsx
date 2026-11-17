import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeeSheetView } from "@/components/live/fee-sheet-view";
import { getPublicFeeSheet } from "@/lib/public-fees-data";
import { verifyFeesViewKey } from "@/lib/share";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; key: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, key } = await params;
  const sheet = verifyFeesViewKey(id, key) ? await getPublicFeeSheet(id) : null;
  return {
    title: sheet ? `${sheet.gameDay.name} · Fees` : "Fees",
    robots: { index: false, follow: false },
  };
}

export default async function FeeSheetPage({ params }: Params) {
  const { id, key } = await params;
  if (!verifyFeesViewKey(id, key)) notFound();
  const sheet = await getPublicFeeSheet(id);
  if (!sheet) notFound();

  return <FeeSheetView initialData={sheet} endpoint={`/api/fees/${id}/${key}`} />;
}
