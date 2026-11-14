"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Clock3, LayoutGrid, MapPin, Save, Wallet } from "lucide-react";
import { toast } from "sonner";
import { updateVenue } from "@/lib/actions/venues";
import { defaultCourtRate, formatPeso, SPLIT_SHUTTLE_RATES } from "@/lib/fees";
import { weekdayLabel } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type VenueRecord = {
  id: string;
  name: string;
  shortName: string;
  dayOfWeek: number;
  defaultStart: string;
  defaultEnd: string;
  defaultCourts: number;
  address: string | null;
};

type AnyResult = { ok: true; message?: string } | { ok: false; error: string };

function detailsFor(venue: VenueRecord | undefined) {
  return {
    name: venue?.name ?? "",
    shortName: venue?.shortName ?? "",
    dayOfWeek: venue?.dayOfWeek ?? 1,
    defaultStart: venue?.defaultStart ?? "10:00",
    defaultEnd: venue?.defaultEnd ?? "14:00",
    defaultCourts: venue?.defaultCourts ?? 3,
    address: venue?.address ?? "",
  };
}

export function VenueSettings({ venues }: { venues: VenueRecord[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [activeId, setActiveId] = React.useState(venues[0]?.id ?? "");
  const [details, setDetails] = React.useState(() => detailsFor(venues[0]));
  const venue = venues.find((row) => row.id === activeId) ?? venues[0];

  if (!venue) return null;

  const selectVenue = (row: VenueRecord) => {
    setActiveId(row.id);
    setDetails(detailsFor(row));
  };

  const act = (fn: () => Promise<AnyResult>, onSuccess?: () => void) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Saved.");
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const saveDetails = () => {
    act(() =>
      updateVenue({
        id: venue.id,
        ...details,
        address: details.address || null,
      }),
    );
  };

  const rate = defaultCourtRate(venue.shortName);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {venues.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => selectVenue(row)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
              row.id === venue.id
                ? "border-forest bg-forest text-cream"
                : "border-line bg-paper hover:border-forest/40",
            )}
          >
            <span
              className={cn(
                "font-display grid h-9 w-9 place-items-center rounded-xl text-sm font-extrabold",
                row.id === venue.id ? "bg-lime text-forest-deep" : "bg-cream-deep text-forest",
              )}
            >
              {row.shortName}
            </span>
            <span>
              <span className="block text-[12px] font-bold">{row.name}</span>
              <span className={cn("block text-[10px]", row.id === venue.id ? "text-cream/60" : "text-muted")}>
                {weekdayLabel(row.dayOfWeek)} · {row.defaultStart}–{row.defaultEnd}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="h-fit p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Venue details</h2>
              <p data-trim-id="venues.defaults-note" className="text-muted text-[11px]">
                Defaults used when creating a new game day.
              </p>
            </div>
            <span className="bg-cream-deep text-forest grid h-9 w-9 place-items-center rounded-xl">
              <Building2 className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <Field label="Venue name">
              <Input
                value={details.name}
                onChange={(event) => setDetails({ ...details, name: event.target.value })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Short code">
                <Input
                  value={details.shortName}
                  onChange={(event) =>
                    setDetails({ ...details, shortName: event.target.value.toUpperCase() })
                  }
                  maxLength={10}
                  className="font-mono"
                />
              </Field>
              <Field label="Weekday">
                <Select
                  value={details.dayOfWeek}
                  onChange={(event) => setDetails({ ...details, dayOfWeek: Number(event.target.value) })}
                >
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                    (day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
              <Field label="Courts">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={details.defaultCourts}
                  onChange={(event) => setDetails({ ...details, defaultCourts: Number(event.target.value) })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default start">
                <Input
                  type="time"
                  value={details.defaultStart}
                  onChange={(event) => setDetails({ ...details, defaultStart: event.target.value })}
                />
              </Field>
              <Field label="Default end">
                <Input
                  type="time"
                  value={details.defaultEnd}
                  onChange={(event) => setDetails({ ...details, defaultEnd: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Address">
              <Input
                value={details.address}
                onChange={(event) => setDetails({ ...details, address: event.target.value })}
              />
            </Field>
            <Button onClick={saveDetails} loading={pending} className="w-full">
              <Save className="h-4 w-4" /> Save venue
            </Button>
          </div>

          <div className="border-line bg-cream/40 text-muted mt-5 space-y-2 rounded-2xl border p-3 text-[11px]">
            <p className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" /> {details.address || "No address yet"}
            </p>
            <p className="flex items-center gap-2">
              <Clock3 className="h-3.5 w-3.5" /> {weekdayLabel(details.dayOfWeek)} · {details.defaultStart}–
              {details.defaultEnd}
            </p>
            <p className="flex items-center gap-2">
              <LayoutGrid className="h-3.5 w-3.5" /> {details.defaultCourts} courts by default
            </p>
          </div>
        </Card>

        <Card className="h-fit p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Court rate · {venue.shortName}</h2>
              <p className="text-muted text-[11px]">Fixed by venue. Used for every game day here.</p>
            </div>
            <Wallet className="text-muted h-5 w-5" />
          </div>
          <p className="font-display mt-4 text-3xl font-extrabold">
            {rate !== null ? formatPeso(rate) : "Not set"}
            <span className="text-muted ml-1 text-sm font-semibold">per court per hour</span>
          </p>
          <div className="border-line bg-cream/40 text-muted mt-4 space-y-2 rounded-2xl border p-3 text-[12px] leading-relaxed">
            <p>
              <span className="text-ink font-semibold">Flat fee</span> = total rent (rate × hours × courts,
              added up over the court blocks) ÷ the players who check in, rounded up to the next peso.
              Everyone pays the same share.
            </p>
            <p>
              <span className="text-ink font-semibold">Shuttles</span>, per game played:{" "}
              {formatPeso(SPLIT_SHUTTLE_RATES.ACTIVE)} Active · {formatPeso(SPLIT_SHUTTLE_RATES.ALUMNI)}{" "}
              Alumni / Inactive / Applicant · {formatPeso(SPLIT_SHUTTLE_RATES.NON_AFFILIATE)} Non-affiliate.
            </p>
            <p>
              {rate !== null
                ? "A game day can use a different rate: set it in New game day or the game day's Settings."
                : "This venue has no default rate yet. Enter the rate on each game day's Settings."}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
