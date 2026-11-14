import { timeToMinutes, type CourtSlot } from "@/lib/datetime";

/**
 * Court plan editing: a game day has one game time (e.g. 1:00–4:00 PM), split into court
 * blocks back to back. The first block starts when the game starts, each block starts when
 * the one before it ends, and the last block ends when the game ends, so blocks can never
 * fall outside the game time. Pure, so it is unit-tested.
 */
export type PlanBlock = { id: string; label: string; start: string; end: string; courts: number };

/** Times are picked in 30-minute steps. */
export const TIME_STEP_MINUTES = 30;
const EARLIEST = 5 * 60;
const LATEST = 23 * 60 + 30;

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "13:00" → "1:00 PM". */
export function formatTime12(time: string): string {
  const total = timeToMinutes(time);
  const hours = Math.floor(total / 60);
  const minutes = String(total % 60).padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${minutes} ${suffix}`;
}

/** "3 hours", "1 hour 30 min", "45 min". */
export function formatSpan(start: string, end: string): string {
  const total = Math.max(0, timeToMinutes(end) - timeToMinutes(start));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const hourText = hours === 0 ? "" : `${hours} hour${hours === 1 ? "" : "s"}`;
  if (!minutes) return hourText || "0 min";
  return hourText ? `${hourText} ${minutes} min` : `${minutes} min`;
}

/**
 * Times to offer strictly after `after` and strictly before `before` (either may be omitted),
 * in 30-minute steps. `keep` is added when it is off the grid, so an existing time never vanishes.
 */
export function timeChoices({
  after,
  before,
  keep,
}: { after?: string; before?: string; keep?: string } = {}): string[] {
  const low = after === undefined ? EARLIEST - 1 : timeToMinutes(after);
  const high = before === undefined ? LATEST + 1 : timeToMinutes(before);
  const times: string[] = [];
  for (let minutes = EARLIEST; minutes <= LATEST; minutes += TIME_STEP_MINUTES) {
    if (minutes > low && minutes < high) times.push(minutesToTime(minutes));
  }
  if (keep && !times.includes(keep)) {
    const value = timeToMinutes(keep);
    if (value > low && value < high) times.push(keep);
    times.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  }
  return times;
}

/** A usable game time: an end at or before the start is pushed two hours past it. */
export function gameTime(start: string, end: string): { start: string; end: string } {
  const from = timeToMinutes(start);
  if (timeToMinutes(end) > from) return { start, end };
  return { start, end: minutesToTime(Math.min(from + 120, LATEST)) };
}

/** The game time a plan covers: first block's start to last block's end. */
export function planWindow(blocks: PlanBlock[]): { start: string; end: string } | null {
  if (blocks.length === 0) return null;
  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  return {
    start: sorted[0].start,
    end: sorted.reduce(
      (last, block) => (timeToMinutes(block.end) > timeToMinutes(last) ? block.end : last),
      sorted[0].end,
    ),
  };
}

/**
 * Lays the blocks back to back across the game time `start`–`end`. Block boundaries keep their
 * times where they still fit; a block squeezed out of the game time is merged into the next.
 * Always keeps at least one block.
 */
export function fitPlan<T extends PlanBlock>(blocks: T[], start: string, end: string): T[] {
  if (blocks.length === 0) return blocks;
  const from = timeToMinutes(start);
  const to = timeToMinutes(end);
  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const kept: T[] = [];
  let cursor = from;
  sorted.forEach((block, index) => {
    const last = index === sorted.length - 1;
    const boundary = timeToMinutes(block.end);
    if (!last && (boundary <= cursor || boundary >= to)) return; // squeezed out: the next block takes over
    const blockEnd = last ? to : boundary;
    kept.push({ ...block, start: minutesToTime(cursor), end: minutesToTime(blockEnd) });
    cursor = blockEnd;
  });
  if (kept.length === 0) kept.push({ ...sorted[sorted.length - 1], start, end });
  // Keep the game's own start and end exactly as typed (they may be off the 30-minute grid).
  kept[0] = { ...kept[0], start };
  kept[kept.length - 1] = { ...kept[kept.length - 1], end };
  return kept;
}

/** A MEGA game day starts out with this much more court time than a regular one. */
export const MEGA_EXTRA_MINUTES = 60;

/**
 * Moves the game's end by `deltaMinutes` (the last block grows or shrinks; earlier boundaries
 * stay). Clamped so the game still ends after it starts and not past the last pickable time.
 * Used to give a MEGA game day an extra hour by default; the queue master can still edit it.
 */
export function shiftPlanEnd<T extends PlanBlock>(blocks: T[], deltaMinutes: number): T[] {
  const game = planWindow(blocks);
  if (!game) return blocks;
  const start = timeToMinutes(game.start);
  const end = Math.min(LATEST, Math.max(start + TIME_STEP_MINUTES, timeToMinutes(game.end) + deltaMinutes));
  return fitPlan(blocks, game.start, minutesToTime(end));
}

/** Moves the boundary after block `index`: it ends, and the next block starts, at `time`. */
export function setBlockEnd<T extends PlanBlock>(blocks: T[], index: number, time: string): T[] {
  if (index < 0 || index >= blocks.length - 1) return blocks;
  return blocks.map((block, i) =>
    i === index ? { ...block, end: time } : i === index + 1 ? { ...block, start: time } : block,
  );
}

/**
 * Adds a block by splitting the longest block in half (on the 30-minute grid). The new block
 * copies the courts of the one it came from and gets an unused "Block N" name. Null when no block is an hour or longer.
 */
export function splitBlock<T extends PlanBlock>(
  blocks: T[],
  make: (from: T, index: number) => T,
): T[] | null {
  let target = -1;
  let longest = 0;
  blocks.forEach((block, index) => {
    const length = timeToMinutes(block.end) - timeToMinutes(block.start);
    if (length >= 2 * TIME_STEP_MINUTES && length >= longest) {
      longest = length;
      target = index;
    }
  });
  if (target < 0) return null;
  const block = blocks[target];
  const start = timeToMinutes(block.start);
  const middle = Math.round((start + longest / 2) / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
  const cut = minutesToTime(
    Math.min(Math.max(middle, start + TIME_STEP_MINUTES), start + longest - TIME_STEP_MINUTES),
  );
  const added = { ...make(block, blocks.length), label: nextBlockLabel(blocks), start: cut, end: block.end };
  return [...blocks.slice(0, target), { ...block, end: cut }, added, ...blocks.slice(target + 1)];
}

/** "Block 2", "Block 3"…: the first such name no block uses yet. */
export function nextBlockLabel(blocks: Array<{ label: string }>): string {
  const used = new Set(blocks.map((block) => block.label.trim().toLowerCase()));
  let number = 2;
  while (used.has(`block ${number}`)) number += 1;
  return `Block ${number}`;
}

/** Removes a block; its time goes to the block before it (or after it, for the first). */
export function removeBlock<T extends PlanBlock>(blocks: T[], index: number): T[] {
  if (blocks.length <= 1 || index < 0 || index >= blocks.length) return blocks;
  const removed = blocks[index];
  const rest = blocks.filter((_, i) => i !== index);
  if (index === 0) rest[0] = { ...rest[0], start: removed.start };
  else rest[index - 1] = { ...rest[index - 1], end: removed.end };
  return rest;
}

/** What is wrong with a court plan, in queue-master words, or null when it is fine. */
export function planProblem(blocks: Array<{ start: string; end: string }>): string | null {
  if (blocks.length === 0) return "Add at least one court block.";
  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  for (const [index, block] of sorted.entries()) {
    if (timeToMinutes(block.end) <= timeToMinutes(block.start))
      return "Each court block must end after it starts.";
    const next = sorted[index + 1];
    if (next && timeToMinutes(next.start) < timeToMinutes(block.end)) return "Court blocks can't overlap.";
  }
  return null;
}

/** A court plan can hold this many blocks (see `gameDayCreateSchema`). */
export const MAX_PLAN_BLOCKS = 8;
const MAX_BLOCK_COURTS = 20;

export type AddedCourt = {
  plan: CourtSlot[];
  /** For each block of the new plan: true when it carries the added court. */
  added: boolean[];
  /** For each block of the new plan: the index of the block it came from in the old plan. */
  origins: number[];
  /** Court-hours the extra court adds, i.e. what it adds to the rent before the rate. */
  courtHours: number;
};

/**
 * Adds one court for the time `from`–`until` only, e.g. an extra court taken for an hour in the
 * middle of the game day. Fees follow court-hours (see `courtHours`), so the court is charged
 * only for that time. A block the time cuts through is split: the part inside gets one more
 * court (named `label`), the parts before and after keep their courts. The time is clipped to
 * the reservation. New blocks get an id from `makeId` and an unused "Block N" name.
 */
export function addCourtForWindow(
  plan: CourtSlot[],
  from: string,
  until: string,
  label: string,
  makeId: (index: number) => string,
): AddedCourt | { error: string } {
  if (plan.length === 0) return { error: "Add a court block in Settings first." };
  if (!/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(until)) return { error: "Pick valid times." };
  const low = timeToMinutes(from);
  const high = timeToMinutes(until);
  if (high <= low) return { error: "The court must be used until a time after it starts." };

  const next: CourtSlot[] = [];
  const added: boolean[] = [];
  const origins: number[] = [];
  const names = plan.map((block) => ({ label: block.label }));
  let minutes = 0;
  let made = 0;
  let full = false;

  plan.forEach((block, origin) => {
    const start = timeToMinutes(block.start);
    const end = timeToMinutes(block.end);
    const a = Math.max(start, low);
    const b = Math.min(end, high);
    if (a >= b) {
      next.push(block);
      added.push(false);
      origins.push(origin);
      return;
    }
    if (block.courts >= MAX_BLOCK_COURTS) full = true;
    const courtLabels = Array.from({ length: block.courts }, (_, index) => block.courtLabels?.[index] ?? "");
    courtLabels.push(label);
    const pieces: Array<{ start: number; end: number; extra: boolean }> = [];
    if (a > start) pieces.push({ start, end: a, extra: false });
    pieces.push({ start: a, end: b, extra: true });
    if (b < end) pieces.push({ start: b, end, extra: false });
    pieces.forEach((piece, index) => {
      // The first piece stays the original block; the rest are new blocks.
      const identity = index === 0 ? { id: block.id, label: block.label } : newBlock();
      next.push({
        ...block,
        ...identity,
        // Keep the block's own start and end exactly as stored (they may be off the grid).
        start: piece.start === start ? block.start : minutesToTime(piece.start),
        end: piece.end === end ? block.end : minutesToTime(piece.end),
        ...(piece.extra ? { courts: block.courts + 1, courtLabels } : {}),
      });
      added.push(piece.extra);
      origins.push(origin);
    });
    minutes += b - a;
  });

  function newBlock() {
    const name = nextBlockLabel(names);
    names.push({ label: name });
    return { id: makeId(made++), label: name };
  }

  if (minutes === 0) return { error: "Pick a time inside the reserved court time." };
  if (full) return { error: `A block can have at most ${MAX_BLOCK_COURTS} courts.` };
  if (next.length > MAX_PLAN_BLOCKS)
    return {
      error: `That would split the court plan into more than ${MAX_PLAN_BLOCKS} blocks. Pick times that line up with the blocks, or tidy the plan in Settings.`,
    };
  return { plan: next, added, origins, courtHours: minutes / 60 };
}

/**
 * Start times to offer for a court added mid-day: every 30 minutes from the start of the
 * reservation up to (not including) its end, plus the start of every block.
 */
export function addCourtStartChoices(plan: PlanBlock[]): string[] {
  const game = planWindow(plan);
  if (!game) return [];
  const start = timeToMinutes(game.start);
  const end = timeToMinutes(game.end);
  // Block starts are offered too, even off the grid, so the court can line up with a block.
  const minutes = new Set(plan.map((block) => timeToMinutes(block.start)));
  for (
    let time = Math.ceil(start / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
    time < end;
    time += TIME_STEP_MINUTES
  ) {
    minutes.add(time);
  }
  return [...minutes]
    .filter((time) => time >= start && time < end)
    .sort((a, b) => a - b)
    .map(minutesToTime);
}

/** The latest of `choices` at or before `now` ("HH:MM"), or the first when `now` is earlier than all. */
export function latestChoiceAtOrBefore(choices: string[], now: string): string {
  const current = timeToMinutes(now);
  let pick = choices[0] ?? now;
  for (const choice of choices) if (timeToMinutes(choice) <= current) pick = choice;
  return pick;
}
