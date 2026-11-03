import Link from "next/link";
import { notFound } from "next/navigation";
import { Settings2 } from "lucide-react";
import { GameDayTabs } from "@/components/app/game-day-tabs";
import { FeeLedger } from "@/components/app/fee-ledger";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatGameDate } from "@/lib/datetime";
import { GAMEDAY_TYPE_LABELS } from "@/lib/fees";
import { getFeeReport } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getFeeReport(id);
  return { title: report ? `Fees · ${report.gameDay.name}` : "Fees" };
}

export default async function FeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getFeeReport(id);
  if (!report) notFound();

  const due = report.rows.filter((row) => !row.paid).length;

  return (
    <>
      <GameDayTabs gameDayId={id} counts={{ due }} />
      <div className="space-y-5">
        <PageHeader
          eyebrow={`${report.gameDay.venue.shortName} · ${formatGameDate(report.gameDay.date, { weekday: true })} · ${GAMEDAY_TYPE_LABELS[report.gameDay.type]}`}
          title="Fees & settlement"
          description="Games are counted automatically when a match is finished. Record payments here as players settle up."
          descriptionTrimId="fees.description"
          actions={
            <Link
              href={`/app/gamedays/${id}/settings`}
              className={buttonVariants({ variant: "paper", size: "sm" })}
            >
              <Settings2 className="h-3.5 w-3.5" /> Change court / fees
            </Link>
          }
        />
        <FeeLedger report={report} />
      </div>
    </>
  );
}
