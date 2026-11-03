import { describe, expect, it } from "vitest";
import { checkLeaveRequest, LEAVE_RETRY_AFTER_DECLINE_MS } from "./leave-request";

const now = new Date("2026-11-04T10:00:00Z");
const base = {
  gameDayStatus: "LIVE" as const,
  playerStatus: "WAITING" as const,
  hasPending: false,
  lastDeclinedAt: null,
  now,
};

describe("checkLeaveRequest", () => {
  it("allows a checked-in player on a live game day", () => {
    expect(checkLeaveRequest(base)).toEqual({ allow: true });
    expect(checkLeaveRequest({ ...base, playerStatus: "PLAYING" })).toEqual({ allow: true });
  });

  it("refuses when the game day is not live", () => {
    expect(checkLeaveRequest({ ...base, gameDayStatus: "COMPLETED" })).toMatchObject({
      allow: false,
      ok: false,
    });
    expect(checkLeaveRequest({ ...base, gameDayStatus: "DRAFT" })).toMatchObject({ allow: false, ok: false });
  });

  it("refuses a nickname that is not on the board", () => {
    const result = checkLeaveRequest({ ...base, playerStatus: null });
    expect(result).toMatchObject({ allow: false, ok: false });
    expect(result.allow === false && result.message).toContain("official nickname");
  });

  it("refuses someone not checked in, and treats someone already done as fine", () => {
    expect(checkLeaveRequest({ ...base, playerStatus: "EXPECTED" })).toMatchObject({
      allow: false,
      ok: false,
    });
    expect(checkLeaveRequest({ ...base, playerStatus: "DONE" })).toMatchObject({ allow: false, ok: true });
  });

  it("does not stack a second request while one is pending", () => {
    expect(checkLeaveRequest({ ...base, hasPending: true })).toMatchObject({ allow: false, ok: true });
  });

  it("blocks asking again right after a decline, then allows it", () => {
    const declined = new Date(now.getTime() - 60_000);
    expect(checkLeaveRequest({ ...base, lastDeclinedAt: declined })).toMatchObject({
      allow: false,
      ok: false,
    });
    const longAgo = new Date(now.getTime() - LEAVE_RETRY_AFTER_DECLINE_MS - 1000);
    expect(checkLeaveRequest({ ...base, lastDeclinedAt: longAgo })).toEqual({ allow: true });
  });
});
