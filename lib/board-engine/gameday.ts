import { fail, ok, type ActionResult } from "@/lib/action-result";
import { addCourtForWindow, formatTime12, planWindow } from "@/lib/court-plan";
import { applyCourtSetup, type CourtSetup } from "@/lib/court-setup";
import {
  courtName,
  currentSlotIndex,
  extendedPlan,
  normalizeCourtLabel,
  QUEUED_COURT,
  renamedCourt,
  withoutCourt,
} from "@/lib/datetime";
import { addCourtSchema, courtSetupSchema } from "@/lib/validation";
import { isActive, transferHint, type OpContext } from "./helpers";
import type { EngineState } from "./types";

/** "N players logged in attendance": everyone checked in is logged when a game day ends. */
export function loggedText(state: EngineState): string {
  const played = state.players.filter((row) => row.status !== "EXPECTED").length;
  return played > 0 ? ` ${played} ${played === 1 ? "player" : "players"} logged in attendance.` : "";
}

export function setGameDayStatus(
  state: EngineState,
  ctx: OpContext,
  status: "DRAFT" | "LIVE" | "COMPLETED",
): ActionResult {
  const { gameDay } = state;
  if (status === "COMPLETED") {
    for (const match of state.matches) {
      if (isActive(match)) Object.assign(match, { status: "CANCELLED", endedAt: ctx.at, updatedAt: ctx.at });
    }
    for (const row of state.players) {
      if (row.status === "PLAYING") Object.assign(row, { status: "DONE", queuedAt: null });
    }
    gameDay.status = "COMPLETED";
    gameDay.completedAt = ctx.at;
    return ok(`Game day closed.${loggedText(state)} Reports are ready to export.`);
  }
  gameDay.status = status;
  if (status === "LIVE") gameDay.startedAt = ctx.at;
  gameDay.completedAt = null;
  return ok(status === "LIVE" ? "Game day is live." : "Game day reopened as a draft.");
}

/**
 * Start a draft game day once the courts are confirmed. Suggested games on courts that no longer
 * exist go to the Next up line.
 */
export function startGameDay(state: EngineState, ctx: OpContext, setup: CourtSetup[]): ActionResult {
  const parsed = courtSetupSchema.safeParse(setup);
  if (!parsed.success) return fail("Check the courts: each block needs a court count and names.");
  if (state.gameDay.status !== "DRAFT") return fail("This game day has already started.");
  const result = applyCourtSetup(state.gameDay.courtPlan, parsed.data);
  if ("error" in result) return fail(result.error);
  const courtsNow = result.plan.length
    ? result.plan[currentSlotIndex(result.plan, new Date(ctx.at))].courts
    : 0;

  Object.assign(state.gameDay, {
    courtPlan: result.plan,
    status: "LIVE",
    startedAt: ctx.at,
    completedAt: null,
  });
  for (const match of state.matches) {
    if (match.status === "SUGGESTED" && match.courtNumber > courtsNow)
      Object.assign(match, { courtNumber: QUEUED_COURT, updatedAt: ctx.at });
  }
  return ok(`Game day is live.${transferHint(state)}`);
}

/** Extend a live game day past its reservation, with `courts` courts until `until`. */
export function extendGameDay(
  state: EngineState,
  ctx: OpContext,
  until: string,
  courts: number,
): ActionResult {
  if (state.gameDay.status === "COMPLETED") return fail("This game day is already closed.");
  const result = extendedPlan(state.gameDay.courtPlan, until, courts);
  if ("error" in result) return fail(result.error);
  state.gameDay.courtPlan = result.plan;
  for (const match of state.matches) {
    if (match.status === "SUGGESTED" && match.courtNumber > courts)
      Object.assign(match, { courtNumber: QUEUED_COURT, updatedAt: ctx.at });
  }
  return ok(`Extended until ${until} with ${courts} ${courts === 1 ? "court" : "courts"}.`);
}

/**
 * Close the game day at the end of the reservation. Games still on court can be counted as played;
 * suggested and waiting games are cancelled. Attendance is logged by the server when it saves.
 */
export function endGameDay(state: EngineState, ctx: OpContext, countLiveGames: boolean): ActionResult {
  if (state.gameDay.status === "COMPLETED") return ok("This game day is already closed.");
  const live = state.matches.filter((match) => match.status === "LIVE");
  if (countLiveGames) {
    for (const match of live) {
      Object.assign(match, { status: "COMPLETED", endedAt: ctx.at, updatedAt: ctx.at });
      if (match.free) continue;
      const ids = new Set(match.players.map((row) => row.playerId));
      for (const row of state.players) {
        if (!ids.has(row.playerId)) continue;
        row.gamesPlayed += 1;
        row.lastPlayedAt = ctx.at;
      }
    }
  }
  for (const match of state.matches) {
    if (isActive(match)) Object.assign(match, { status: "CANCELLED", endedAt: ctx.at, updatedAt: ctx.at });
  }
  for (const row of state.players) {
    if (row.status === "PLAYING" || row.status === "WAITING")
      Object.assign(row, { status: "DONE", queuedAt: null });
  }
  state.gameDay.status = "COMPLETED";
  state.gameDay.completedAt = ctx.at;
  const counted =
    countLiveGames && live.length > 0
      ? ` ${live.length} game${live.length === 1 ? "" : "s"} in progress counted.`
      : "";
  return ok(`Game day ended.${counted}${loggedText(state)} Collect fees next.`);
}

/**
 * Add one court mid-session for the time it is used. The plan is split around that time, so the
 * rent counts the court only for those hours. The answer says which block to show afterwards.
 */
export function addCourt(
  state: EngineState,
  ctx: OpContext,
  slotIndex: number,
  input: { label?: string; from: string; until: string | null },
): ActionResult<{ slotIndex: number }> {
  if (state.gameDay.status === "COMPLETED") return fail("This game day is already closed.");
  const parsed = addCourtSchema.safeParse(input);
  if (!parsed.success) return fail("Pick when the court is used.");
  const plan = state.gameDay.courtPlan;
  if (!plan[slotIndex]) return fail("Pick a court block first.");
  const reserved = planWindow(plan);
  if (!reserved) return fail("Add a court block in Settings first.");
  const now = new Date(ctx.at);
  const wasInPlay = slotIndex === currentSlotIndex(plan, now);

  const result = addCourtForWindow(
    plan,
    parsed.data.from,
    parsed.data.until ?? reserved.end,
    normalizeCourtLabel(parsed.data.label ?? ""),
    (index) => `slot-${ctx.at}-${index}`,
  );
  if ("error" in result) return fail(result.error);

  // Games sit on court positions of the block in play, so a waiting game can only be transferred
  // onto the new court when the court is in play right now.
  const nowIndex = currentSlotIndex(result.plan, now);
  const inPlay = result.added[nowIndex];
  state.gameDay.courtPlan = result.plan;

  const withCourt = result.plan.filter((_, index) => result.added[index]);
  const first = withCourt[0];
  const name = courtName(first, first.courts);
  const when = `${formatTime12(first.start)}–${formatTime12(withCourt[withCourt.length - 1].end)}`;
  const fromSame = (index: number) => result.origins[index] === slotIndex;
  const firstAdded = result.plan.findIndex((_, index) => fromSame(index) && result.added[index]);
  const view = wasInPlay
    ? nowIndex
    : firstAdded >= 0
      ? firstAdded
      : Math.max(
          0,
          result.plan.findIndex((_, index) => fromSame(index)),
        );
  return ok(
    inPlay
      ? `${name} added for ${when}.${transferHint(state)}`
      : `${name} added for ${when}. It shows on the board in that court block.`,
    { slotIndex: view },
  );
}

/**
 * Remove one court from a block mid-session. A suggested game on it moves to the waiting courts;
 * a game in progress must be finished or cancelled first. Later courts keep their names.
 */
export function removeCourt(
  state: EngineState,
  ctx: OpContext,
  slotIndex: number,
  court: number,
): ActionResult {
  if (state.gameDay.status === "COMPLETED") return fail("This game day is already closed.");
  const plan = state.gameDay.courtPlan;
  const slot = plan[slotIndex];
  if (!slot) return fail("Pick a court block first.");
  if (!Number.isInteger(court) || court < 1 || court > slot.courts) return fail("Pick a valid court.");
  const name = courtName(slot, court);
  if (slot.courts <= 1)
    return fail(`${name} is the only court in ${slot.label}. Change the block in Settings instead.`);

  // Games sit on court positions of the block in play, so only that block's games move.
  const inPlay = slotIndex === currentSlotIndex(plan, new Date(ctx.at));
  const onCourt = inPlay
    ? state.matches.find((match) => match.courtNumber === court && isActive(match))
    : undefined;
  if (onCourt?.status === "LIVE") return fail(`${name} has a game in progress. Finish or cancel it first.`);

  state.gameDay.courtPlan = plan.map((row, index) => (index === slotIndex ? withoutCourt(row, court) : row));
  if (inPlay) {
    for (const match of state.matches) {
      if (!isActive(match)) continue;
      if (match === onCourt) Object.assign(match, { courtNumber: QUEUED_COURT, updatedAt: ctx.at });
      else if (match.courtNumber > court)
        Object.assign(match, { courtNumber: match.courtNumber - 1, updatedAt: ctx.at });
    }
  }
  return ok(
    onCourt
      ? `${name} removed. Its suggested game moved to the waiting courts.`
      : `${name} removed from ${slot.label}.`,
  );
}

/** Rename a court from the board, in one block or at that position in every block. */
export function renameCourt(
  state: EngineState,
  _ctx: OpContext,
  slotIndex: number,
  court: number,
  label: string,
  everyBlock: boolean,
): ActionResult {
  const plan = state.gameDay.courtPlan;
  const slot = plan[slotIndex];
  if (!slot) return fail("Pick a court block first.");
  if (!Number.isInteger(court) || court < 1 || court > slot.courts) return fail("Pick a valid court.");
  const result = renamedCourt(plan, slotIndex, court, label, everyBlock);
  if ("error" in result) return fail(result.error);
  state.gameDay.courtPlan = result.plan;
  const before = courtName(slot, court);
  const after = courtName(result.plan[slotIndex], court);
  return ok(
    before === after
      ? `${after} unchanged.`
      : `${before} is now ${after}${everyBlock ? " in every block" : ""}.`,
  );
}
