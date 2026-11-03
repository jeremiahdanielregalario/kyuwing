"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, CircleDollarSign, Clock3, LayoutGrid, MapPin, Save, Wallet } from "lucide-react";
import { toast } from "sonner";
import { saveFeeRules, updateVenue } from "@/lib/actions/venues";
import { CATEGORY_LABELS, GAMEDAY_TYPE_LABELS } from "@/lib/fees";
import { weekdayLabel } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FeeRule = {
  dayType: "REGULAR" | "TIPID" | "MEGA";
  category: "ACTIVE" | "ALUMNI" | "APPLICANT";
  flatFee: number;
  perGameFee: number;
};

type VenueRecord = {
  id: string;
  name: string;
  shortName: string;
  dayOfWeek: number;
  defaultStart: string;
  defaultEnd: string;
  defaultCourts: number;
  address: string | null;
  feeRules: FeeRule[];
};

type AnyResult = { ok: true; message?: string } | { ok: false; error: string };

const DAY_TYPES: Array<"REGULAR" | "TIPID" | "MEGA"> = ["REGULAR", "TIPID", "MEGA"];
const CATEGORIES: Array<"ACTIVE" | "ALUMNI" | "APPLICANT"> = ["ACTIVE", "ALUMNI", "APPLICANT"];

function key(dayType: string, category: string) {
  return `${dayType}:${category}`;
}

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

function rulesFor(venue: VenueRecord | undefined) {
  const initial: Record<string, { flatFee: number; perGameFee: number }> = {};
  for (const row of venue?.feeRules ?? []) {
    initial[key(row.dayType, row.category)] = { flatFee: row.flatFee, perGameFee: row.perGameFee };
  }
  return initial;
}

export function VenueSettings({ venues }: { venues: VenueRecord[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [activeId, setActiveId] = React.useState(venues[0]?.id ?? "");
  const [details, setDetails] = React.useState(() => detailsFor(venues[0]));
  const [rules, setRules] = React.useState(() => rulesFor(venues[0]));
  const venue = venues.find((row) => row.id === activeId) ?? venues[0];

  if (!venue) return null;

  const selectVenue = (row: VenueRecord) => {
    setActiveId(row.id);
    setDetails(detailsFor(row));
    setRules(rulesFor(row));
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

  const saveFees = () => {
    const payload = DAY_TYPES.flatMap((dayType) =>
      CATEGORIES.map((category) => ({
        dayType,
        category,
        flatFee: Number(rules[key(dayType, category)]?.flatFee ?? 0),
        perGameFee: Number(rules[key(dayType, category)]?.perGameFee ?? 0),
      })),
    );
    act(() => saveFeeRules(venue.id, payload));
  };

  const updateRule = (dayType: string, category: string, field: "flatFee" | "perGameFee", value: number) => {
    setRules((current) => ({
      ...current,
      [key(dayType, category)]: {
        flatFee: field === "flatFee" ? value : (current[key(dayType, category)]?.flatFee ?? 0),
        perGameFee: field === "perGameFee" ? value : (current[key(dayType, category)]?.perGameFee ?? 0),
      },
    }));
  };

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

        <Card className="overflow-hidden">
          <div className="border-line/80 flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-bold">Fee table · {venue.shortName}</h2>
              <p className="text-muted text-[11px]">
                Total = flat fee + (games × per-game rate). All values in pesos.
              </p>
            </div>
            <Wallet className="text-muted h-5 w-5" />
          </div>

          <div className="p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-3">
              {DAY_TYPES.map((dayType) => (
                <div key={dayType} className="border-line bg-cream/30 rounded-2xl border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-forest text-[10px] font-bold tracking-[0.12em] uppercase">
                      {GAMEDAY_TYPE_LABELS[dayType]}
                    </p>
                    <CircleDollarSign className="text-muted h-3.5 w-3.5" />
                  </div>
                  {dayType === "TIPID" && (
                    <p className="text-muted mb-2 text-[9px] leading-snug">
                      Usually court fee only. Set per-game to 0.
                    </p>
                  )}
                  {dayType === "MEGA" && (
                    <p className="text-muted mb-2 text-[9px] leading-snug">
                      Use a separate scale for big sessions.
                    </p>
                  )}
                  <div className="space-y-2">
                    {CATEGORIES.map((category) => {
                      const value = rules[key(dayType, category)] ?? { flatFee: 0, perGameFee: 0 };
                      return (
                        <div key={category} className="border-line/70 bg-paper rounded-xl border p-2">
                          <p className="text-ink-soft text-[10px] font-semibold">
                            {CATEGORY_LABELS[category]}
                          </p>
                          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                            <label className="block">
                              <span className="text-muted text-[8px] tracking-wide uppercase">Flat</span>
                              <Input
                                type="number"
                                min={0}
                                value={value.flatFee}
                                onChange={(event) =>
                                  updateRule(dayType, category, "flatFee", Number(event.target.value))
                                }
                                className="h-8 px-2 font-mono text-[12px]"
                              />
                            </label>
                            <label className="block">
                              <span className="text-muted text-[8px] tracking-wide uppercase">/ game</span>
                              <Input
                                type="number"
                                min={0}
                                value={value.perGameFee}
                                onChange={(event) =>
                                  updateRule(dayType, category, "perGameFee", Number(event.target.value))
                                }
                                className="h-8 px-2 font-mono text-[12px]"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-line bg-cream/40 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3">
              <p data-trim-id="venues.fee-note" className="text-muted max-w-md text-[11px] leading-relaxed">
                These are placeholder rates. Replace them with the official UP BadAss rates before the first
                live game day. Changes apply immediately to reports calculated from this table.
              </p>
              <Button onClick={saveFees} loading={pending}>
                <Check className="h-4 w-4" /> Save fee table
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
