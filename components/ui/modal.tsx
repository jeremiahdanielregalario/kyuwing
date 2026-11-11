"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

/** Distance (px) a sheet must be dragged down before letting go closes it. */
const DISMISS_DISTANCE = 96;

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

  // Stay rendered after `open` turns false so the exit animation can play.
  const [rendered, setRendered] = React.useState(open);
  if (open && !rendered) setRendered(true);
  const closing = rendered && !open;

  // Keep the last content on screen while the sheet slides away.
  const [snapshot, setSnapshot] = React.useState({ title, description, children, footer });
  if (
    open &&
    (snapshot.title !== title ||
      snapshot.description !== description ||
      snapshot.children !== children ||
      snapshot.footer !== footer)
  ) {
    setSnapshot({ title, description, children, footer });
  }
  const view = open ? { title, description, children, footer } : snapshot;

  const [drag, setDrag] = React.useState(0);
  const dragStart = React.useRef<number | null>(null);

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

  if (!mounted || !rendered) return null;

  // Confirmations often have no body; skip the empty strip between header and footer.
  const hasBody = view.children !== null && view.children !== undefined && view.children !== false;

  const onPointerDown = (event: React.PointerEvent) => {
    // Swipe-to-close is a touch gesture for the phone sheet only.
    if (event.pointerType === "mouse" || window.matchMedia("(min-width: 640px)").matches) return;
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    dragStart.current = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDrag(Math.max(0, event.clientY - dragStart.current));
  };
  const onPointerEnd = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (drag > DISMISS_DISTANCE) onClose();
    setDrag(0);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="presentation"
      data-state={closing ? "closing" : "open"}
    >
      <div
        className="modal-backdrop bg-forest-deep/50 absolute inset-0 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={view.title}
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) setRendered(false);
        }}
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
        className={cn(
          "modal-panel border-line bg-paper shadow-float relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.875rem] border pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-(--ease-fluid) sm:rounded-3xl sm:pb-0",
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
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          className={cn("touch-none sm:touch-auto", hasBody && "border-line/80 border-b")}
        >
          <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
            <span className="bg-line-strong h-1.5 w-10 rounded-full" />
          </div>
          <div className="flex items-start justify-between gap-4 px-5 pt-2 pb-4 sm:px-6 sm:pt-4">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">{view.title}</h2>
              {view.description && <p className="text-muted mt-0.5 text-[13px]">{view.description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="press text-muted hover:bg-cream-deep hover:text-ink grid h-9 w-9 shrink-0 place-items-center rounded-full"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {hasBody && (
          <div className="hide-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            {view.children}
          </div>
        )}
        {view.footer && (
          <div className="border-line/80 bg-cream/40 flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3.5 sm:px-6">
            {view.footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
