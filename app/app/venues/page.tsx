import { VenueSettings } from "@/components/app/venue-settings";
import { PageHeader } from "@/components/ui/page-header";
import { getVenuesWithFees } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venues & fees" };

export default async function VenuesPage() {
  const venues = await getVenuesWithFees();
  const records = venues.map((venue) => ({
    id: venue.id,
    name: venue.name,
    shortName: venue.shortName,
    dayOfWeek: venue.dayOfWeek,
    defaultStart: venue.defaultStart,
    defaultEnd: venue.defaultEnd,
    defaultCourts: venue.defaultCourts,
    address: venue.address,
    feeRules: venue.feeRules.map((rule) => ({
      dayType: rule.dayType,
      category: rule.category,
      flatFee: rule.flatFee,
      perGameFee: rule.perGameFee,
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Courts & money"
        title="Venues & fees"
        description="KBC on Mondays, DASC on Saturdays. Set the default court blocks and the flat + per-game rates for every player type and game-day type."
      />
      <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-900">
        <span className="font-semibold">Exact rates to follow.</span> The seeded values are development
        placeholders so the ledger is testable. Update the table below before using the app for an official UP
        BadAss game day.
      </div>
      <VenueSettings venues={records} />
    </div>
  );
}
