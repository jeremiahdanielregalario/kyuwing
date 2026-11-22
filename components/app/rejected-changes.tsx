"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import type { RejectedChange } from "@/lib/offline/game-day-sync";
import { formatClock } from "@/lib/datetime";

const noop = () => () => {};

/**
 * Changes made on this tablet that the server refused (usually because the game day changed on
 * another device first). Stays on screen until the queue master closes it, so nothing is missed.
 * On phones it sits over the <BoardLock> banner, which shows again once this is closed.
 */
export function RejectedChanges({
  changes,
  onDismiss,
}: {
  changes: RejectedChange[];
  onDismiss: () => void;
}) {
  const mounted = React.useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!mounted || changes.length === 0) return null;
  return createPortal(
    <div
      role="alert"
      className="border-coral/40 bg-coral-soft text-ink fixed inset-x-3 bottom-24 z-[51] mx-auto max-w-md rounded-2xl border p-4 shadow-lg sm:right-6 sm:left-auto sm:mx-0 lg:bottom-6"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-coral mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {changes.length === 1 ? "A change wasn't saved" : `${changes.length} changes weren't saved`}
          </p>
          <p className="text-muted mt-0.5 text-xs">
            The board now shows what the server has. Redo these if they&rsquo;re still needed.
          </p>
          <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs">
            {changes.map((change) => (
              <li key={change.id}>
                <span className="font-semibold">{change.label}</span>
                <span className="text-muted"> · {formatClock(new Date(change.at))}</span>
                <span className="block">{change.error}</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="press text-muted hover:text-ink -m-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-full"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
