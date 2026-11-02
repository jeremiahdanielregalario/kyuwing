import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  tone = "forest",
}: {
  className?: string;
  tone?: "forest" | "lime" | "paper";
}) {
  const bg = tone === "forest" ? "#0d3b2e" : tone === "lime" ? "#c9f26d" : "#fffdf7";
  const feather = tone === "lime" ? "#0d3b2e" : "#c9f26d";
  const cork = tone === "paper" ? "#0d3b2e" : "#fffdf7";
  return (
    <svg viewBox="0 0 48 48" className={cn("h-10 w-10", className)} aria-hidden="true">
      <rect width="48" height="48" rx="15" fill={bg} />
      <path d="M24 8.5 33 15l-2.7 12.5H17.7L15 15Z" fill={feather} />
      <path
        d="M24 8.5 21 27.5M24 8.5 27 27.5M15.8 16.5h16.4M16.8 22h14.4"
        stroke={bg}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".7"
      />
      <circle cx="24" cy="33" r="4.6" fill={cork} stroke={feather} strokeWidth="2" />
      <path d="M22.6 39.5h2.8" stroke={feather} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="Kyuwing home"
    >
      <BrandMark className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-6" />
      {!compact && (
        <span className="font-display text-ink text-[1.35rem] leading-none font-extrabold tracking-[-0.04em]">
          kyuwing<span className="text-forest-soft">.</span>
        </span>
      )}
    </Link>
  );
}

export function OrgBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-line bg-paper/70 text-ink-soft inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] uppercase backdrop-blur",
        className,
      )}
    >
      <span className="bg-coral inline-block h-1.5 w-1.5 rounded-full" />
      UP BadAss · Diliman
    </span>
  );
}
