"use client";

import * as React from "react";

/**
 * A list whose items glide to their new places when the order changes, instead of jumping.
 * Each direct child that carries `data-flip-id` is tracked; `order` is the ids joined in order,
 * so positions are only measured when the order really changed.
 *
 * Uses the Web Animations API, so it layers over an item's own CSS animation and leaves no
 * inline styles behind. Does nothing when the visitor prefers reduced motion.
 */
export function FlipList({
  order,
  className,
  children,
}: {
  order: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const places = React.useRef(new Map<string, { x: number; y: number }>());

  React.useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const items = Array.from(box.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && !!child.dataset.flipId,
    );
    const still =
      items.length > 150 ||
      typeof box.animate !== "function" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // A glide still under way would skew the measurement.
    for (const item of items) {
      for (const animation of item.getAnimations?.() ?? []) {
        if (animation.id === "flip") animation.cancel();
      }
    }

    const origin = box.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number }>();
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      const place = { x: rect.left - origin.left, y: rect.top - origin.top };
      const id = item.dataset.flipId!;
      next.set(id, place);
      const before = places.current.get(id);
      if (still || !before) continue;
      const dx = before.x - place.x;
      const dy = before.y - place.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      const glide = item.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
      glide.id = "flip";
    }
    places.current = next;
  }, [order]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
