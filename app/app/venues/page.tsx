import { VenueSettings } from "@/components/app/venue-settings";
import { PageHeader } from "@/components/ui/page-header";
import { getVenues } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venues" };

export default async function VenuesPage() {
  const venues = await getVenues();
  const records = venues.map((venue) => ({
    id: venue.id,
    name: venue.name,
    shortName: venue.shortName,
    dayOfWeek: venue.dayOfWeek,
    defaultStart: venue.defaultStart,
    defaultEnd: venue.defaultEnd,
    defaultCourts: venue.defaultCourts,
    address: venue.address,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Courts & money"
        title="Venues"
        description="KBC on Mondays, DASC on Saturdays. Set the default court blocks for each venue. The court rate is fixed per venue: DASC ₱300 and KBC ₱250 per court per hour."
        descriptionTrimId="venues.description"
      />
      <VenueSettings venues={records} />
    </div>
  );
}
