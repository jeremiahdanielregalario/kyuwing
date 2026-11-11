/**
 * Light haptic feedback for touch devices. No-ops where vibration is
 * unsupported (iOS Safari, desktops) or the user prefers reduced motion.
 */
export type HapticKind = "tap" | "success" | "warning";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  success: [10, 40, 16],
  warning: [24, 60, 24],
};

export function haptic(kind: HapticKind = "tap") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some browsers throw when vibration is blocked by permissions policy.
  }
}
