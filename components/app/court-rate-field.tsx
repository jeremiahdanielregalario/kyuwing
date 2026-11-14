"use client";

import { Field, Input } from "@/components/ui/input";
import {
  courtCost,
  courtHours,
  defaultCourtRate,
  effectiveCourtRate,
  formatPeso,
  SPLIT_SHUTTLE_RATES,
} from "@/lib/fees";

type Plan = Array<{ start: string; end: string; courts: number }>;

/**
 * The court rate for a game day. The venue's default applies (DASC ₱300, KBC ₱250 per
 * court per hour); typing a rate here overrides it for this game day only. The flat fee
 * is always the total rent divided by the players who check in.
 */
export function CourtRateField({
  value,
  onChange,
  plan,
  venueShortName,
}: {
  value: string;
  onChange: (value: string) => void;
  plan: Plan;
  venueShortName: string;
}) {
  const venueDefault = defaultCourtRate(venueShortName);
  const override = value.trim() === "" ? null : Number(value);
  const rate = effectiveCourtRate(override && override > 0 ? override : null, venueShortName);
  const hours = courtHours(plan);

  return (
    <Field
      label="Court rate per hour"
      hint={
        venueDefault !== null
          ? `Peso rate per court per hour. ${venueShortName} is ${formatPeso(venueDefault)} unless you type a different rate here for this game day.`
          : `Peso rate per court per hour. ${venueShortName} has no default rate, so enter what the venue charges.`
      }
    >
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
        inputMode="numeric"
        placeholder={venueDefault !== null ? `${venueDefault} (venue default)` : "e.g. 250"}
        maxLength={6}
      />
      {rate > 0 && (
        <p className="text-muted mt-2 text-[12px] leading-relaxed">
          <span className="text-ink font-semibold">
            {hours} court-hours × {formatPeso(rate)} = {formatPeso(courtCost(plan, rate))}
          </span>
          , divided by the players who check in (rounded up) is the flat fee. Shuttles per game:{" "}
          {formatPeso(SPLIT_SHUTTLE_RATES.ACTIVE)} Active · {formatPeso(SPLIT_SHUTTLE_RATES.ALUMNI)} Alumni /
          Inactive / Applicant · {formatPeso(SPLIT_SHUTTLE_RATES.NON_AFFILIATE)} Non-affiliate.
        </p>
      )}
    </Field>
  );
}
