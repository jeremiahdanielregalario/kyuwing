"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  // False during SSR, true after hydration — avoids a portal hydration mismatch.
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  // Confirmations often have no body; skip the empty strip between header and footer.
  const hasBody = children !== null && children !== undefined && children !== false;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="presentation"
    >
      <div
        className="bg-forest-deep/50 absolute inset-0 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "border-line bg-paper shadow-float relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border sm:rounded-3xl",
          {
            sm: "sm:max-w-md",
            md: "sm:max-w-xl",
            lg: "sm:max-w-3xl",
            xl: "sm:max-w-5xl",
          }[size],
          className,
        )}
      >
        <div
          className={cn(
            "border-line/80 flex items-start justify-between gap-4 px-5 py-4 sm:px-6",
            hasBody && "border-b",
          )}
        >
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
            {description && <p className="text-muted mt-0.5 text-[13px]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:bg-cream-deep hover:text-ink grid h-9 w-9 shrink-0 place-items-center rounded-full transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {hasBody && <div className="hide-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>}
        {footer && (
          <div className="border-line/80 bg-cream/40 flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3.5 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
