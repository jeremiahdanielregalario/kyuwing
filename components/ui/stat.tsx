import * as React from "react";
import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "paper",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "paper" | "forest" | "lime" | "coral";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4",
        tone === "paper" && "border-line bg-paper",
        tone === "forest" && "border-forest bg-forest text-cream",
        tone === "lime" && "border-lime-deep/40 bg-lime text-forest-deep",
        tone === "coral" && "border-coral/30 bg-coral-soft text-ink",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "text-[10px] font-bold tracking-[0.16em] uppercase",
            tone === "forest" ? "text-cream/60" : "text-muted",
          )}
        >
          {label}
        </p>
        {icon && (
          <span className={cn("shrink-0", tone === "forest" ? "text-lime/70" : "text-forest/50")}>
            {icon}
          </span>
        )}
      </div>
      <p className="font-display mt-2 text-[1.9rem] leading-none font-extrabold tracking-tight">{value}</p>
      {hint && (
        <p className={cn("mt-1.5 text-[11px]", tone === "forest" ? "text-cream/60" : "text-muted")}>{hint}</p>
      )}
    </div>
  );
}
