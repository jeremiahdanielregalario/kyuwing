"use client";

import { Field, Input } from "@/components/ui/input";
import { courtCost, courtHours, formatPeso, SPLIT_SHUTTLE_RATES } from "@/lib/fees";

type Plan = Array<{ start: string; end: string; courts: number }>;

/**
 * Optional custom fee scheme for a game day: enter what the venue charges per
 * court per hour and the court cost is split among players as the flat fee.
 * Left blank, the venue's own fee rules apply.
 */
export function CourtRateField({
  value,
  onChange,
  plan,
}: {
  value: string;
  onChange: (value: string) => void;
  plan: Plan;
}) {
  const rate = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(rate) && rate > 0;
  const hours = courtHours(plan);

  return (
    <Field
      label="Court rate per hour (optional)"
      hint="Peso rate per court per hour. Fill this in to split the court cost evenly among the players as the flat fee, at any venue. Leave blank to use the venue's fee rates."
    >
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
        inputMode="numeric"
        placeholder="e.g. 200"
        maxLength={6}
      />
      {valid && (
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
