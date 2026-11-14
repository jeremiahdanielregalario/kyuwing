import { playSound } from "./sounds";

/**
 * Light feedback for a press: a short vibration on touch devices (a no-op where vibration is
 * unsupported, e.g. iOS Safari and desktops, or the user prefers reduced motion), plus the
 * matching sound cue for a success or a warning (see `lib/sounds.ts`; taps stay silent).
 */
export type HapticKind = "tap" | "success" | "warning";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  success: [10, 40, 16],
  warning: [24, 60, 24],
};

export function haptic(kind: HapticKind = "tap") {
  if (kind === "success") playSound("success");
  else if (kind === "warning") playSound("error");
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some browsers throw when vibration is blocked by permissions policy.
  }
}
