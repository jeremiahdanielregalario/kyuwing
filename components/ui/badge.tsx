import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "green" | "lime" | "coral" | "sky" | "amber" | "forest" | "outline";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-none font-semibold tracking-wide",
        {
          neutral: "bg-cream-deep text-ink-soft",
          green: "bg-emerald-100 text-emerald-800",
          lime: "bg-lime/60 text-forest-deep",
          coral: "bg-coral-soft text-[#b53b21]",
          sky: "bg-sky/60 text-sky-900",
          amber: "bg-amber-100 text-amber-900",
          forest: "bg-forest text-cream",
          outline: "border-line text-ink-soft border bg-transparent",
        }[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Dot({
  className,
  tone = "green",
}: {
  className?: string;
  tone?: "green" | "lime" | "coral" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        {
          green: "bg-emerald-500",
          lime: "bg-lime-deep",
          coral: "bg-coral",
          muted: "bg-muted/50",
        }[tone],
        className,
      )}
    />
  );
}
