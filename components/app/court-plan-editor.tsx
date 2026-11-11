"use client";

import * as React from "react";
import { ChevronDown, Clock3, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fitPlan,
  formatSpan,
  formatTime12,
  gameTime,
  planWindow,
  removeBlock,
  setBlockEnd,
  splitBlock,
  timeChoices,
  type PlanBlock,
} from "@/lib/court-plan";

const LATEST_START = "23:00";

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted mb-1 block text-[10px] font-bold tracking-[0.12em] uppercase">
      {children}
    </span>
  );
}

function TimeSelect({
  value,
  choices,
  onChange,
  label,
  className,
}: {
  value: string;
  choices: string[];
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="border-line text-ink focus:border-forest/50 focus:ring-lime/60 h-10 w-full appearance-none rounded-xl border bg-white pr-5 pl-2 text-[13px] tabular-nums transition-colors focus:ring-2 focus:outline-none"
      >
        {choices.map((time) => (
          <option key={time} value={time}>
            {formatTime12(time)}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="text-muted pointer-events-none absolute top-1/2 right-1.5 h-3 w-3 -translate-y-1/2"
      />
    </div>
  );
}

/** A time that follows from the game time or another block, so it isn't edited here. */
function FixedTime({ time, note }: { time: string; note: string }) {
  return (
    <div
      title={note}
      className="border-line bg-cream-deep/50 text-ink flex h-10 items-center rounded-xl border px-2 text-[13px] tabular-nums"
    >
      {formatTime12(time)}
    </div>
  );
}

/**
 * Game time first (e.g. 1:00–4:00 PM), then the court blocks that split it. Blocks run back to
 * back inside the game time: only the times between blocks are picked here, so a block can never
 * start before the game or run past it (see `lib/court-plan.ts`).
 */
export function CourtPlanEditor<T extends PlanBlock>({
  blocks,
  onChange,
  makeBlock,
  courtsFor,
  renderExtra,
  footnote,
}: {
  blocks: T[];
  onChange: (blocks: T[]) => void;
  /** A new block split off `from`, e.g. with the same court numbers. Start and end are set for you. */
  makeBlock: (from: T, index: number) => T;
  /** The court count to show, and whether it is set elsewhere (e.g. by typed court numbers). */
  courtsFor?: (block: T) => { value: number; locked: boolean };
  /** Extra fields under a block, e.g. court numbers or names. */
  renderExtra?: (block: T, index: number, update: (patch: Partial<T>) => void) => React.ReactNode;
  footnote?: React.ReactNode;
}) {
  const game = planWindow(blocks) ?? { start: "10:00", end: "12:00" };
  const update = (index: number, patch: Partial<T>) =>
    onChange(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  const split = splitBlock(blocks, makeBlock);

  // The end moves out with the start when the start passes it.
  const changeStart = (start: string) => {
    const next = gameTime(start, game.end);
    onChange(fitPlan(blocks, next.start, next.end));
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted mb-2 text-[10px] font-bold tracking-[0.14em] uppercase">Game time</p>
        <div className="border-line bg-cream/30 rounded-xl border p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0">
              <SmallLabel>Starts</SmallLabel>
              <TimeSelect
                label="Game starts"
                value={game.start}
                choices={timeChoices({ before: LATEST_START, keep: game.start })}
                onChange={changeStart}
              />
            </label>
            <label className="block min-w-0">
              <SmallLabel>Ends</SmallLabel>
              <TimeSelect
                label="Game ends"
                value={game.end}
                choices={timeChoices({ after: game.start, keep: game.end })}
                onChange={(end) => onChange(fitPlan(blocks, game.start, end))}
              />
            </label>
          </div>
          <p className="text-muted mt-2 inline-flex items-center gap-1.5 text-[12px]">
            <Clock3 className="h-3.5 w-3.5" />
            <span>
              <span className="text-ink font-semibold">{formatSpan(game.start, game.end)}</span> ·{" "}
              {formatTime12(game.start)} – {formatTime12(game.end)}
            </span>
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-muted text-[10px] font-bold tracking-[0.14em] uppercase">Court blocks</p>
          <button
            type="button"
            onClick={() => split && onChange(split)}
            disabled={!split}
            title={
              split ? "Split the game time into another block" : "Blocks are already as short as they go"
            }
            className="text-forest inline-flex min-h-9 items-center gap-1 px-1 text-[12px] font-semibold hover:underline disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Add block
          </button>
        </div>
        <div className="space-y-2">
          {blocks.map((block, index) => {
            const last = index === blocks.length - 1;
            const courts = courtsFor?.(block) ?? { value: block.courts, locked: false };
            return (
              <div key={block.id} className="border-line bg-cream/30 rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={block.label}
                    onChange={(event) => update(index, { label: event.target.value } as Partial<T>)}
                    className="h-10 min-w-0 flex-1 text-[13px]"
                    aria-label="Block name"
                    maxLength={30}
                  />
                  {blocks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onChange(removeBlock(blocks, index))}
                      className="text-muted hover:bg-coral-soft hover:text-coral grid h-10 w-10 shrink-0 place-items-center rounded-lg transition"
                      aria-label={`Remove ${block.label || "block"}`}
                      title="Remove this block; its time joins the block next to it"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-[1fr_1fr_3.25rem] gap-1.5">
                  <div className="min-w-0">
                    <SmallLabel>Starts</SmallLabel>
                    <FixedTime
                      time={block.start}
                      note={index === 0 ? "When the game starts" : "When the block before it ends"}
                    />
                  </div>
                  <label className="block min-w-0">
                    <SmallLabel>Ends</SmallLabel>
                    {last ? (
                      <FixedTime time={block.end} note="When the game ends" />
                    ) : (
                      <TimeSelect
                        label={`${block.label || "Block"} ends`}
                        value={block.end}
                        choices={timeChoices({
                          after: block.start,
                          before: blocks[index + 1].end,
                          keep: block.end,
                        })}
                        onChange={(time) => onChange(setBlockEnd(blocks, index, time))}
                      />
                    )}
                  </label>
                  <label className="block min-w-0">
                    <SmallLabel>Courts</SmallLabel>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      value={courts.value}
                      readOnly={courts.locked}
                      title={courts.locked ? "Set by the court numbers below" : undefined}
                      onChange={(event) =>
                        update(index, { courts: Number(event.target.value) } as Partial<T>)
                      }
                      className="h-10 px-2 text-center text-[13px]"
                      aria-label={`${block.label || "Block"} courts`}
                    />
                  </label>
                </div>
                {renderExtra?.(block, index, (patch) => update(index, patch))}
              </div>
            );
          })}
        </div>
        <p className="text-muted mt-1.5 text-[11px] leading-relaxed">
          Blocks run back to back inside the game time. Add a block when the number of courts changes, e.g. 3
          courts from 1–2 PM, then 4 from 2–4 PM.
          {footnote ? <> {footnote}</> : null}
        </p>
      </div>
    </div>
  );
}
