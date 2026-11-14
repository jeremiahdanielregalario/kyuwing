import { describe, expect, it } from "vitest";
import { deviceLabel, formatSignInTime, signInStatus, signedInFor } from "./sign-in-log";

describe("deviceLabel", () => {
  it("names the device and browser", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("iPhone · Safari");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
      ),
    ).toBe("Android · Chrome");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0",
      ),
    ).toBe("Mac · Edge");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) [FBAN/MessengerForiOS;FBAV/480.0]")).toBe(
      "iPhone · Messenger",
    );
    expect(deviceLabel("curl/8.0")).toBe("Unknown device");
    expect(deviceLabel(null)).toBeNull();
  });
});

describe("signInStatus", () => {
  const expiresAt = new Date("2026-11-15T15:00:00Z");
  it("tells signed in, signed out, signed in again and expired apart", () => {
    const now = new Date("2026-11-15T03:00:00Z");
    expect(signInStatus({ expiresAt, signedOutAt: null, endReason: null }, now).kind).toBe("active");
    const out = new Date("2026-11-15T02:00:00Z");
    expect(signInStatus({ expiresAt, signedOutAt: out, endReason: "SIGNED_OUT" }, now)).toEqual({
      kind: "signed-out",
      label: "Signed out",
      at: out,
    });
    expect(signInStatus({ expiresAt, signedOutAt: out, endReason: "SIGNED_IN_AGAIN" }, now).kind).toBe(
      "replaced",
    );
    expect(
      signInStatus({ expiresAt, signedOutAt: null, endReason: null }, new Date("2026-11-16T00:00:00Z")),
    ).toEqual({
      kind: "expired",
      label: "Expired",
      at: expiresAt,
    });
  });
});

describe("signedInFor and formatSignInTime", () => {
  it("reads like a duration and a Manila 12-hour time", () => {
    const from = new Date("2026-11-15T01:02:00Z");
    expect(signedInFor(from, new Date("2026-11-15T03:17:00Z"))).toBe("2h 15m");
    expect(signedInFor(from, new Date("2026-11-15T01:42:00Z"))).toBe("40m");
    expect(signedInFor(from, new Date("2026-11-15T03:02:00Z"))).toBe("2h");
    expect(signedInFor(from, from)).toBe("under a minute");
    expect(formatSignInTime(from)).toBe("Sun, Nov 15, 9:02 AM");
  });
});
