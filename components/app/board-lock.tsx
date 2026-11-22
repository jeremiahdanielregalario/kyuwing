"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, type ConfirmSpec } from "@/components/ui/confirm-dialog";
import { holderName } from "@/lib/board-lease";
import type { SyncStatus } from "@/lib/offline/game-day-sync";
import type { OpResult } from "@/lib/board-engine/ops";

const noop = () => () => {};

/**
 * Shown while another device holds the board and this one can't change it: the holder is out
 * of touch (its offline copy is the one that counts), or this device is offline itself. With
 * signal, the queue master can take the board over, e.g. when the holding tablet died.
 */
export function BoardLock({
  status,
  onTakeOver,
}: {
  status: SyncStatus;
  onTakeOver: () => Promise<OpResult>;
}) {
  const [spec, setSpec] = React.useState<ConfirmSpec | null>(null);
  const mounted = React.useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!mounted || !status.locked) return null;
  const holder = status.lease ? holderName(status.lease) : "another device";

  const askTakeOver = () =>
    setSpec({
      title: "Take over the board?",
      description: `${holder} holds the board and hasn't been online for a while. If you take over, this device holds the board instead, and any changes still unsent on ${holder} are refused when it reconnects. Only do this if that device is dead, lost, or won't be used again today.`,
      confirmLabel: "Take over",
      tone: "danger",
      onConfirm: () => {
        void onTakeOver().then((result) => {
          if (result.ok) toast.success(result.message ?? "This device now holds the board.");
          else toast.error(result.error);
        });
      },
    });

  return (
    <>
      {createPortal(
        <div
          role="status"
          className="bg-ink text-cream fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl p-4 shadow-lg sm:right-auto sm:left-6 sm:mx-0 lg:bottom-6"
        >
          <div className="flex items-start gap-3">
            <Lock className="text-lime mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">View only on this device</p>
              <p className="mt-0.5 text-xs opacity-80">{status.locked}</p>
              {status.online ? (
                <Button
                  size="sm"
                  variant="paper"
                  className="mt-3"
                  disabled={status.takingOver}
                  onClick={askTakeOver}
                >
                  {status.takingOver ? "Taking over…" : "Take over the board"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      )}
      <ConfirmDialog spec={spec} onClose={() => setSpec(null)} />
    </>
  );
}
