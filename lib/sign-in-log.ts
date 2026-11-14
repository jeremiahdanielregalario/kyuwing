import { MANILA_TIMEZONE } from "./datetime";

/**
 * Pure helpers for the developer's Sign-in log: a short device label from the browser's
 * user agent, and how a sign-in ended. The database writes are in `lib/actions/auth.ts`.
 */

export type SignInEnd = "SIGNED_OUT" | "SIGNED_IN_AGAIN";

/** "iPhone · Safari", "Android · Chrome", "Mac · Messenger": enough to tell devices apart. */
export function deviceLabel(userAgent: string | null | undefined): string | null {
  const ua = userAgent ?? "";
  if (!ua.trim()) return null;
  const os = /iPad/.test(ua)
    ? "iPad"
    : /iPhone|iPod/.test(ua)
      ? "iPhone"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Macintosh|Mac OS X/.test(ua)
            ? "Mac"
            : /CrOS/.test(ua)
              ? "Chromebook"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  const browser = /FBAN\/Messenger|MessengerForiOS|FB_IAB\/MESSENGER|MessengerLite/i.test(ua)
    ? "Messenger"
    : /FBAN|FBAV|FB_IAB/.test(ua)
      ? "Facebook"
      : /Instagram/.test(ua)
        ? "Instagram"
        : /EdgA?\/|EdgiOS/.test(ua)
          ? "Edge"
          : /SamsungBrowser/.test(ua)
            ? "Samsung Internet"
            : /OPR\/|Opera/.test(ua)
              ? "Opera"
              : /FxiOS|Firefox\//.test(ua)
                ? "Firefox"
                : /CriOS|Chrome\//.test(ua)
                  ? "Chrome"
                  : /Safari\//.test(ua)
                    ? "Safari"
                    : null;
  const label = [os, browser].filter(Boolean).join(" · ");
  return label || "Unknown device";
}

export type SignInStatus =
  | { kind: "active"; label: "Signed in" }
  | { kind: "signed-out"; label: "Signed out"; at: Date }
  | { kind: "replaced"; label: "Signed in again"; at: Date }
  | { kind: "expired"; label: "Expired"; at: Date };

/** How a sign-in stands at `now`: still signed in, signed out, replaced, or timed out. */
export function signInStatus(
  row: { expiresAt: Date; signedOutAt: Date | null; endReason: string | null },
  now: Date,
): SignInStatus {
  if (row.signedOutAt) {
    return row.endReason === "SIGNED_IN_AGAIN"
      ? { kind: "replaced", label: "Signed in again", at: row.signedOutAt }
      : { kind: "signed-out", label: "Signed out", at: row.signedOutAt };
  }
  if (row.expiresAt.getTime() <= now.getTime())
    return { kind: "expired", label: "Expired", at: row.expiresAt };
  return { kind: "active", label: "Signed in" };
}

/** "2h 15m", "40m", "under a minute". */
export function signedInFor(from: Date, to: Date): string {
  const minutes = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return "under a minute";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

/** "Sun, Nov 15, 9:02 AM" in Manila time, 12-hour. */
export function formatSignInTime(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}
