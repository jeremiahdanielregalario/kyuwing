/**
 * Rules for "I'm leaving" requests sent from the public live link.
 * Pure, so the decisions can be unit-tested; the database work is in
 * `lib/leave-requests.ts`.
 */

/** After a decline, the same player cannot ask again for this long. */
export const LEAVE_RETRY_AFTER_DECLINE_MS = 5 * 60 * 1000;

export type LeaveCheck = { allow: true } | { allow: false; ok: boolean; message: string };

export function checkLeaveRequest(input: {
  gameDayStatus: "DRAFT" | "LIVE" | "COMPLETED";
  /** The player's status on this game day, or null if the nickname is not on the board. */
  playerStatus: "EXPECTED" | "WAITING" | "PLAYING" | "DONE" | null;
  hasPending: boolean;
  /** When this player's most recent request was declined, if ever. */
  lastDeclinedAt: Date | null;
  now: Date;
}): LeaveCheck {
  if (input.gameDayStatus !== "LIVE") {
    return { allow: false, ok: false, message: "The game day isn't running, so there is nothing to leave." };
  }
  if (!input.playerStatus) {
    return {
      allow: false,
      ok: false,
      message:
        "That nickname isn't on today's board. Type your official nickname, the one the queue master uses.",
    };
  }
  if (input.playerStatus === "DONE") {
    return { allow: false, ok: true, message: "You're already marked done for the day. Thanks for playing!" };
  }
  if (input.playerStatus === "EXPECTED") {
    return {
      allow: false,
      ok: false,
      message: "You haven't been checked in yet, so there is nothing to leave.",
    };
  }
  if (input.hasPending) {
    return { allow: false, ok: true, message: "Already sent. The queue master will confirm shortly." };
  }
  if (
    input.lastDeclinedAt &&
    input.now.getTime() - input.lastDeclinedAt.getTime() < LEAVE_RETRY_AFTER_DECLINE_MS
  ) {
    return {
      allow: false,
      ok: false,
      message: "The queue master asked you to stay for now. Talk to them at the courts.",
    };
  }
  return { allow: true };
}
