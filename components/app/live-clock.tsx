"use client";

import * as React from "react";
import { formatClock, formatDuration } from "@/lib/datetime";
import { cn } from "@/lib/utils";

/**
 * One shared one-second ticker for the whole page. Timers subscribe to it on their own, so a
 * tick redraws only the few characters of each timer instead of the whole board.
 *
 * The clock reads 0 on the server and during hydration (Date.now() during render is a
 * hydration mismatch); the real time arrives right after mount.
 */
const subscribers = new Set<() => void>();
let current = 0;
let timer: number | null = null;

function tick() {
  current = Date.now();
  subscribers.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  subscribers.add(notify);
  if (timer === null) {
    current = Date.now();
    timer = window.setInterval(tick, 1000);
  }
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

const serverSnapshot = () => 0;

/**
 * The time now, in milliseconds, refreshed every `stepMs`. Pass a coarse step (e.g. 10 000)
 * where only minutes matter, so the component redraws that rarely.
 */
export function useClock(stepMs = 1000): number {
  const snapshot = React.useCallback(() => Math.floor(current / stepMs) * stepMs, [stepMs]);
  return React.useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Running time since a moment, e.g. how long a game has been on. */
export function ElapsedTimer({ since }: { since: string | null }) {
  const now = useClock();
  const seconds = since && now ? Math.max(0, Math.floor((now - Date.parse(since)) / 1000)) : 0;
  return <>{formatDuration(seconds)}</>;
}

/** A waiting player's time in the queue; turns amber after 5 minutes and coral after 15. */
export function WaitTimer({ queuedAt, className }: { queuedAt: string | null; className?: string }) {
  const now = useClock();
  const wait = queuedAt && now ? Math.max(0, Math.floor((now - Date.parse(queuedAt)) / 1000)) : 0;
  return (
    <span
      className={cn(
        "shrink-0 font-mono font-bold tabular-nums transition-colors duration-500",
        wait < 5 * 60 ? "text-forest" : wait < 15 * 60 ? "text-amber-700" : "text-coral",
        className,
      )}
      title="Waiting time"
    >
      {formatDuration(wait)}
    </span>
  );
}

/** The Manila wall clock, to the minute. */
export function ManilaClock() {
  const now = useClock(5000);
  return <>{now ? formatClock(new Date(now)) : "--:--"}</>;
}
