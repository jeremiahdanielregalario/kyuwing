"use client";

import * as React from "react";
import { Clock3, Minus, Play, Plus, TriangleAlert } from "lucide-react";
import { formatTime12 } from "@/lib/court-plan";
import { courtNamesText, courtSetupProblem, resizedCourtNames, type CourtSetup } from "@/lib/court-setup";
import { courtName, parseCourtNumbers, type CourtSlot } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

/**
 * "Check the courts" before a game day goes live: per block, how many courts were reserved and
 * what the venue calls them. Mount it only while open, so it starts from the saved plan.
 */
export function StartGameDayDialog({
  plan,
  venue,
  pending,
  onClose,
  onStart,
}: {
  plan: CourtSlot[];
  venue: string;
  pending: boolean;
  onClose: () => void;
  onStart: (setup: CourtSetup[]) => void;
}) {
  const [rows, setRows] = React.useState<CourtSetup[]>(() =>
    plan.map((slot) => ({ id: slot.id, courts: slot.courts, names: courtNamesText(slot) })),
  );
  const problems = rows.map((row) => courtSetupProblem(row.courts, row.names));
  const blocked = problems.some(Boolean);

  const update = (index: number, patch: Partial<CourtSetup>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...patch } : row)));

  // Typing names sets the count; the stepper changes the count and extends a run of numbers.
  const typeNames = (index: number, names: string) => {
    const count = parseCourtNumbers(names).length;
    update(index, count > 0 ? { names, courts: Math.min(20, count) } : { names });
  };
  const step = (index: number, delta: number) => {
    const row = rows[index];
    const courts = Math.min(20, Math.max(1, row.courts + delta));
    update(index, { courts, names: resizedCourtNames(row.names, courts) ?? row.names });
  };

  const copyToAll = (index: number) =>
    setRows((current) =>
      current.map((row) => ({ ...row, courts: current[index].courts, names: current[index].names })),
    );

  return (
    <Modal
      open
      onClose={onClose}
      title="Check the courts before you start"
      description={`Match these to what ${venue} gave you today. Players and the live view will see these court names.`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={() => onStart(rows)} loading={pending} disabled={blocked}>
            <Play className="h-4 w-4" /> Courts are right, start
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {plan.map((slot, index) => {
          const row = rows[index];
          const problem = problems[index];
          const labels = parseCourtNumbers(row.names);
          const changed = row.courts !== slot.courts;
          return (
            <section
              key={slot.id}
              data-trim-id="board.start-courts"
              className={cn(
                "rounded-2xl border p-3.5",
                problem ? "border-coral/40 bg-coral-soft/40" : "border-line bg-cream/40",
              )}
            >
              {plan.length > 1 && (
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold">
                  <Clock3 className="text-muted h-3.5 w-3.5" /> {slot.label} · {formatTime12(slot.start)} –{" "}
                  {formatTime12(slot.end)}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold">Courts reserved</p>
                  <p className="text-muted text-[11px]">
                    {changed
                      ? `Was ${slot.courts}. Saving changes the plan.`
                      : "Is this how many the venue gave you?"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => step(index, -1)}
                    disabled={row.courts <= 1}
                    className="press border-line bg-paper grid h-11 w-11 place-items-center rounded-full border disabled:opacity-40"
                    aria-label={`One court fewer${plan.length > 1 ? ` in ${slot.label}` : ""}`}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span
                    className="font-display w-10 text-center text-2xl font-extrabold tabular-nums"
                    aria-live="polite"
                  >
                    {row.courts}
                  </span>
                  <button
                    type="button"
                    onClick={() => step(index, 1)}
                    disabled={row.courts >= 20}
                    className="press border-line bg-paper grid h-11 w-11 place-items-center rounded-full border disabled:opacity-40"
                    aria-label={`One more court${plan.length > 1 ? ` in ${slot.label}` : ""}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <label className="mt-3 block">
                <span className="text-muted mb-1 block text-[10px] font-bold tracking-[0.12em] uppercase">
                  Court names
                </span>
                <Input
                  value={row.names}
                  onChange={(event) => typeNames(index, event.target.value)}
                  placeholder="e.g. 1, 2, 3 or 5-8"
                  className="h-11 text-[14px]"
                  inputMode="text"
                  aria-invalid={Boolean(problem)}
                />
              </label>
              {problem ? (
                <p className="text-coral mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {problem}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {labels.map((_, position) => (
                    <span
                      key={position}
                      className="border-line bg-paper rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                    >
                      {courtName({ ...slot, courts: labels.length, courtLabels: labels }, position + 1)}
                    </span>
                  ))}
                </div>
              )}
              {plan.length > 1 &&
                index === 0 &&
                !problem &&
                rows.some((other) => other.names !== row.names || other.courts !== row.courts) && (
                  <button
                    type="button"
                    onClick={() => copyToAll(index)}
                    className="text-forest mt-2 min-h-9 text-[12px] font-semibold hover:underline"
                  >
                    Use these courts in every block
                  </button>
                )}
            </section>
          );
        })}
        <p className="text-muted text-[11px] leading-relaxed">
          Use the numbers painted on the venue&apos;s courts, separated by commas (or a range like 5-8). You
          can still rename a court or add one from the board later.
        </p>
      </div>
    </Modal>
  );
}
