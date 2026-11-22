import { fail, ok, type ActionResult } from "@/lib/action-result";
import { buildFeeSchedule, changeDue, extrasTotal, formatPeso, isQueueMasterOnDuty } from "@/lib/fees";
import { chargesSchema, courtHoursSchema, flatBaseFeeSchema, PAYMENT_METHOD_KEYS } from "@/lib/validation";
import { playerBySession, type OpContext } from "./helpers";
import type { EnginePlayer, EngineState, PaymentMethod } from "./types";

export function feeSchedule(state: EngineState) {
  return buildFeeSchedule({
    courtPlan: state.gameDay.courtPlan,
    ratePerCourtHour: state.gameDay.courtRatePerHour,
    courtHoursOverride: state.gameDay.courtHoursOverride,
    flatBaseFee: state.gameDay.flatBaseFee ?? null,
    venueShortName: state.gameDay.venue.shortName,
    attendees: state.players.filter((row) => row.status !== "EXPECTED").length,
    gameDate: state.gameDay.date,
  });
}

/** A player's fee before extras, with the parts the ledger shows. */
export function feeOf(
  state: EngineState,
  row: EnginePlayer,
  schedule = feeSchedule(state),
  voucher = row.voucher,
) {
  const queueMaster = isQueueMasterOnDuty(row.nickname, state.gameDay.queueMasterName, row.aliases);
  return { queueMaster, ...schedule.feeFor(row.category, row.gamesPlayed, { queueMaster, voucher }) };
}

/**
 * Sets the court-hours the fee split uses, superseding the hours from the court plan. `null` goes
 * back to the plan's hours.
 */
export function setCourtHours(state: EngineState, _ctx: OpContext, hours: number | null): ActionResult {
  const parsed = courtHoursSchema.safeParse(hours);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter the court-hours.");
  state.gameDay.courtHoursOverride = parsed.data;
  return ok(
    parsed.data === null
      ? "Court-hours follow the court plan again."
      : `Court-hours set to ${parsed.data}. Fees are worked out from that now.`,
  );
}

/**
 * Sets how the base price is worked out: a flat amount every player pays, or `null` to split the
 * court cost among everyone checked in.
 */
export function setBaseFee(state: EngineState, _ctx: OpContext, amount: number | null): ActionResult {
  const parsed = flatBaseFeeSchema.safeParse(amount);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter the base fee.");
  state.gameDay.flatBaseFee = parsed.data;
  return ok(
    parsed.data === null
      ? "Base fee is split from the court cost again."
      : `Base fee set to a flat ${formatPeso(parsed.data)}.`,
  );
}

export type PaymentInput = {
  paid: boolean;
  amountPaid?: number;
  method?: PaymentMethod | null;
  /** Grips and any other charge for this player; omitted leaves them as they are. */
  charges?: { gripCount: number; otherCharge: number; otherNote?: string | null; voucher?: number };
};

export function setPayment(
  state: EngineState,
  _ctx: OpContext,
  sessionPlayerId: string,
  input: PaymentInput,
): ActionResult {
  if (input.method && !(PAYMENT_METHOD_KEYS as readonly string[]).includes(input.method))
    return fail("Pick how they paid.");
  const row = playerBySession(state, sessionPlayerId);
  if (!row) return fail("Player not found in this game day.");

  let { gripCount, otherCharge, otherNote, voucher } = row;
  if (input.charges) {
    const parsed = chargesSchema.safeParse(input.charges);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the extra charges.");
    gripCount = parsed.data.gripCount;
    otherCharge = parsed.data.otherCharge;
    otherNote = otherCharge > 0 ? parsed.data.otherNote || null : null;
    voucher = parsed.data.voucher ?? voucher;
  }

  const fee = feeOf(state, row, feeSchedule(state), voucher);
  const total = fee.total + extrasTotal({ gripCount, otherCharge });
  const amount = Math.max(0, Math.round(input.amountPaid ?? (input.paid ? total : 0)));
  // The amount decides: fully covered is paid. Only a zero-total player can be marked paid outright.
  const paid = total > 0 ? amount >= total : input.paid;
  const kept = paid ? amount : Math.min(amount, total);

  Object.assign(row, {
    paid,
    amountPaid: kept,
    paymentMethod: paid ? (input.method ?? "CASH") : null,
    gripCount,
    otherCharge,
    otherNote,
    voucher,
    // Exact payment is settled right away; overpaying leaves it open until the change is handed back.
    settled: paid && changeDue(total, kept) === 0,
  });
  return ok(
    paid
      ? changeDue(total, kept) > 0
        ? `${row.nickname} paid. Give back ${formatPeso(changeDue(total, kept))} change.`
        : `${row.nickname} marked paid.`
      : "Saved.",
  );
}

/** Tick or untick "settled": paid in full and any change handed back. */
export function setSettled(
  state: EngineState,
  _ctx: OpContext,
  sessionPlayerId: string,
  settled: boolean,
): ActionResult {
  const row = playerBySession(state, sessionPlayerId);
  if (!row) return fail("Player not found in this game day.");
  if (settled && !row.paid) return fail(`${row.nickname} has not paid in full yet.`);
  row.settled = settled;
  return ok(settled ? `${row.nickname} settled.` : `${row.nickname} reopened.`);
}

export function markAllPaid(state: EngineState): ActionResult<{ updated: number }> {
  const schedule = feeSchedule(state);
  let updated = 0;
  for (const row of state.players) {
    if (row.paid) continue;
    const total = feeOf(state, row, schedule).total + extrasTotal(row);
    Object.assign(row, { paid: true, amountPaid: total, paymentMethod: "CASH", settled: true });
    updated += 1;
  }
  return ok(updated ? `${updated} players marked paid.` : "Everyone is already marked paid.", { updated });
}
