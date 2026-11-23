"use client";

import * as React from "react";
import { makeGameDayActions } from "@/lib/offline/actions";
import { useGameDaySync, type GameDayBootstrap, type SyncStatus } from "@/lib/offline/game-day-sync";

/**
 * A game day page (board, Fees, Sign-ups) working on this device's copy, so presses answer at
 * once and keep working on weak or no signal. Changes the server later refuses are listed in
 * `status.rejected`; show them with <RejectedChanges> and clear them with `dismissRejected`.
 * While another device holds the board out of touch, `status.locked` says why; show <BoardLock>.
 */
export function useOfflineGameDay(bootstrap: GameDayBootstrap) {
  const sync = useGameDaySync(bootstrap);
  const { run, current } = sync;
  const actions = React.useMemo(
    () => makeGameDayActions(bootstrap.state.gameDay.id, run, current),
    [bootstrap.state.gameDay.id, run, current],
  );
  return {
    state: sync.state,
    status: sync.status,
    actions,
    refresh: sync.refresh,
    dismissRejected: sync.dismissRejected,
    takeOver: sync.takeOver,
  };
}

/** A short line about saving: offline, changes waiting, or saved. */
export function syncLabel(status: SyncStatus): { text: string; tone: "ok" | "wait" | "warn" } {
  if (status.problem) return { text: status.problem, tone: "warn" };
  if (status.locked) return { text: "View only · another device holds the board", tone: "warn" };
  const waiting =
    status.pending > 0 ? `${status.pending} ${status.pending === 1 ? "change" : "changes"}` : "";
  if (!status.online)
    return {
      text: waiting ? `Offline · ${waiting} saved on this tablet` : "Offline · working on this tablet",
      tone: "warn",
    };
  if (waiting) return { text: `Saving ${waiting}…`, tone: "wait" };
  return { text: "Saved · live on all devices", tone: "ok" };
}
