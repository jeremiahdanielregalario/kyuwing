import { describe, expect, it } from "vitest";
import {
  LEASE_STALE_MS,
  TAKEN_OVER_MESSAGE,
  decodeLeaseHeader,
  encodeLeaseHeader,
  formatAgo,
  judgeChange,
  judgeTakeover,
  leaseView,
  lockReason,
  type Lease,
} from "./board-lease";

const now = 1_000_000;
const tablet: Lease = {
  deviceId: "tablet-1",
  seenAt: now - 1_000,
  epoch: 0,
  name: "Ana",
  device: "iPad · Safari",
};
const phone = { deviceId: "phone-1", name: "Ben", label: "iPhone · Safari" };

describe("judgeChange", () => {
  it("lets the first device hold the board", () => {
    const result = judgeChange(null, phone, now);
    expect(result).toEqual({
      ok: true,
      next: { deviceId: "phone-1", seenAt: now, epoch: 0, name: "Ben", device: "iPhone · Safari" },
    });
  });

  it("lets the holder keep changing it, even after a long time offline", () => {
    const result = judgeChange(
      { ...tablet, seenAt: now - 10 * 60_000 },
      { deviceId: "tablet-1", epoch: 0 },
      now,
    );
    expect(result.ok && result.next.seenAt).toBe(now);
  });

  it("moves the board to another device while the holder is online", () => {
    const result = judgeChange(tablet, { ...phone, epoch: 0 }, now);
    expect(result.ok && result.next).toMatchObject({ deviceId: "phone-1", epoch: 0 });
  });

  it("refuses another device while the holder is out of touch", () => {
    const result = judgeChange({ ...tablet, seenAt: now - LEASE_STALE_MS - 1 }, phone, now);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("Ana (iPad · Safari), offline for 30 s");
  });

  it("allows another device right up to the timeout", () => {
    expect(judgeChange({ ...tablet, seenAt: now - LEASE_STALE_MS }, phone, now).ok).toBe(true);
  });

  it("refuses changes made before a takeover, even from the old holder", () => {
    const taken = { ...tablet, deviceId: "phone-1", epoch: 1 };
    expect(judgeChange(taken, { deviceId: "tablet-1", epoch: 0 }, now)).toEqual({
      ok: false,
      error: TAKEN_OVER_MESSAGE,
    });
  });

  it("doesn't check the epoch when the sender didn't give one (a server action)", () => {
    expect(judgeChange({ ...tablet, epoch: 3 }, { deviceId: "tablet-1" }, now).ok).toBe(true);
  });
});

describe("judgeTakeover", () => {
  it("raises the epoch when the holder is out of touch", () => {
    const next = judgeTakeover({ ...tablet, seenAt: now - 60_000 }, phone, now);
    expect(next).toMatchObject({ deviceId: "phone-1", epoch: 1, seenAt: now });
  });

  it("changes nothing while the holder is online", () => {
    expect(judgeTakeover(tablet, phone, now)).toBe(tablet);
  });

  it("claims a board nobody holds", () => {
    expect(judgeTakeover(null, phone, now)).toMatchObject({ deviceId: "phone-1", epoch: 0 });
  });
});

describe("leaseView", () => {
  it("tells each device whether it holds the board", () => {
    expect(leaseView(tablet, "tablet-1", now)).toMatchObject({ holder: "you", ageMs: 1_000 });
    expect(leaseView(tablet, "phone-1", now)).toMatchObject({
      holder: "other",
      name: "Ana",
      label: "iPad · Safari",
    });
    expect(leaseView(null, "phone-1", now).holder).toBe("none");
  });

  it("survives the header round trip with non-ASCII names", () => {
    const view = leaseView({ ...tablet, name: "Niña" }, "phone-1", now);
    expect(decodeLeaseHeader(encodeLeaseHeader(view))).toEqual(view);
    expect(decodeLeaseHeader("garbage%")).toBeNull();
  });
});

describe("lockReason", () => {
  const other = { ...leaseView(tablet, "phone-1", now), receivedAt: now };

  it("doesn't lock the holder, or before the lease is known", () => {
    expect(lockReason({ ...other, holder: "you" }, false, now)).toBeNull();
    expect(lockReason(null, false, now)).toBeNull();
  });

  it("locks a non-holder while it is offline itself", () => {
    expect(lockReason(other, false, now)).toContain("You're offline");
  });

  it("locks once the holder has been out of touch for the timeout, counting time since the answer", () => {
    expect(lockReason(other, true, now + 20_000)).toBeNull();
    expect(lockReason(other, true, now + 40_000)).toContain("offline for 41 s");
  });
});

describe("formatAgo", () => {
  it("reads naturally", () => {
    expect(formatAgo(45_000)).toBe("45 s");
    expect(formatAgo(3 * 60_000 + 5_000)).toBe("3 min");
    expect(formatAgo(125 * 60_000)).toBe("2 h 5 min");
  });
});
