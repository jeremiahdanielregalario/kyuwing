import { describe, expect, it } from "vitest";
import { canUndoCheckIn } from "./check-in";

const waiting = { nickname: "Lou", status: "WAITING" as const, gamesPlayed: 0, linedUpFor: null };

describe("canUndoCheckIn", () => {
  it("allows a waiting player who has not played or been lined up", () => {
    expect(canUndoCheckIn(waiting)).toEqual({ allow: true });
  });

  it("refuses someone who is not checked in, on court, or done", () => {
    expect(canUndoCheckIn({ ...waiting, status: "EXPECTED" })).toMatchObject({ allow: false });
    expect(canUndoCheckIn({ ...waiting, status: "PLAYING" })).toMatchObject({ allow: false });
    const done = canUndoCheckIn({ ...waiting, status: "DONE" });
    expect(done.allow === false && done.reason).toContain("Requeue");
  });

  it("refuses someone who already played, pointing to Done instead", () => {
    const result = canUndoCheckIn({ ...waiting, gamesPlayed: 2 });
    expect(result.allow === false && result.reason).toContain("2 games");
  });

  it("refuses someone lined up for a game, naming it", () => {
    const result = canUndoCheckIn({ ...waiting, linedUpFor: "Court 5" });
    expect(result.allow === false && result.reason).toContain("Court 5");
  });
});
