/**
 * The "check your courts" step when a game day starts: for each court block, how many courts
 * were reserved and what the venue calls them ("1, 2, 3" or "5-8"). Pure, shared by the start
 * dialog and the `startGameDay` server action.
 */
import { parseCourtNumbers, type CourtSlot } from "./datetime";

export type CourtSetup = { id: string; courts: number; names: string };

/** A block's court names as typed text, e.g. "5, 6, 7, 8"; unnamed courts show their position. */
export function courtNamesText(slot: Pick<CourtSlot, "courts" | "courtLabels">): string {
  return Array.from(
    { length: slot.courts },
    (_, index) => slot.courtLabels?.[index]?.trim() || String(index + 1),
  ).join(", ");
}

/**
 * Names for a new court count, when they can be worked out: a run of numbers grows or shrinks
 * ("5, 6, 7" with 4 courts reads "5, 6, 7, 8"), other names are cut when there are fewer
 * courts. Returns null when the master has to type the extra names.
 */
export function resizedCourtNames(names: string, courts: number): string | null {
  const labels = parseCourtNumbers(names);
  const numbers = labels.map(Number);
  const isRun =
    labels.length > 0 &&
    labels.every((label) => /^\d+$/.test(label)) &&
    numbers.every((value, index) => index === 0 || value === numbers[index - 1] + 1);
  if (labels.length === 0 || isRun) {
    const first = labels.length ? numbers[0] : 1;
    return Array.from({ length: courts }, (_, index) => String(first + index)).join(", ");
  }
  if (courts <= labels.length) return labels.slice(0, courts).join(", ");
  return null;
}

/** Why a block's setup can't be saved, or null when it is fine. */
export function courtSetupProblem(courts: number, names: string): string | null {
  if (!Number.isInteger(courts) || courts < 1 || courts > 20) return "Pick between 1 and 20 courts.";
  const labels = parseCourtNumbers(names);
  if (labels.length === 0) return "Type the court names, e.g. 1, 2, 3.";
  if (labels.length !== courts) {
    return `${labels.length} ${labels.length === 1 ? "name" : "names"} for ${courts} ${courts === 1 ? "court" : "courts"}. Give each court one name.`;
  }
  return null;
}

/** The court plan with the confirmed counts and names. Blocks not in `setup` stay as they are. */
export function applyCourtSetup(
  plan: CourtSlot[],
  setup: CourtSetup[],
): { plan: CourtSlot[] } | { error: string } {
  const next: CourtSlot[] = [];
  for (const slot of plan) {
    const row = setup.find((entry) => entry.id === slot.id);
    if (!row) {
      next.push(slot);
      continue;
    }
    const problem = courtSetupProblem(row.courts, row.names);
    if (problem) return { error: plan.length > 1 ? `${slot.label}: ${problem}` : problem };
    next.push({ ...slot, courts: row.courts, courtLabels: parseCourtNumbers(row.names) });
  }
  return { plan: next };
}
