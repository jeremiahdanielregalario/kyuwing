"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export type ConfirmSpec = {
  title: string;
  description?: string;
  /** Optional styled block under the title, e.g. the teams on court. */
  detail?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" paints the confirm button coral for destructive actions. */
  tone?: "primary" | "danger";
  onConfirm: () => void;
};

/**
 * Branded replacement for window.confirm. Pass a ConfirmSpec via state:
 *
 *   const [confirmSpec, setConfirmSpec] = React.useState<ConfirmSpec | null>(null);
 *   <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
 */
export function ConfirmDialog({
  spec,
  onClose,
}: {
  spec: ConfirmSpec | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(spec)}
      onClose={onClose}
      title={spec?.title ?? ""}
      description={spec?.description}
      size="sm"
      className="sm:max-w-md"
      footer={
        spec && (
          <>
            <Button variant="paper" onClick={onClose}>
              {spec.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={spec.tone === "danger" ? "danger" : "primary"}
              autoFocus
              onClick={() => {
                const run = spec.onConfirm;
                onClose();
                run();
              }}
            >
              {spec.confirmLabel}
            </Button>
          </>
        )
      }
    >
      {spec?.detail ?? null}
    </Modal>
  );
}
