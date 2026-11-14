import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The app's logo: the UP BadAss emblem (the feather from the official logo, without the
 * lettering). It is black, gold and grey on transparency, so it is always placed on a white
 * "sticker" chip. That keeps it legible on the bone page background and on the black app sidebar.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-white ring-1 ring-black/5",
        className,
      )}
    >
      <img
        src="/brand/upbadass-emblem.svg"
        alt="UP BadAss"
        className="h-[78%] w-auto max-w-[86%] object-contain"
      />
    </span>
  );
}

export function Logo({
  compact = false,
  tone = "ink",
  className,
}: {
  compact?: boolean;
  tone?: "ink" | "cream";
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="Kyuwing home"
    >
      <BrandMark className="h-10 w-10 transition-transform duration-300 group-hover:-rotate-2" />
      {!compact && (
        <span
          className={cn(
            "font-brand text-[1.15rem] leading-none tracking-tight",
            tone === "cream" ? "text-cream" : "text-ink",
          )}
        >
          kyuwing<span className="text-lime-deep">.</span>
        </span>
      )}
    </Link>
  );
}

export function OrgBadge({ className, tone = "ink" }: { className?: string; tone?: "ink" | "cream" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] uppercase",
        tone === "cream" ? "border-cream/20 bg-cream/5 text-cream/70" : "border-line bg-paper text-ink-soft",
        className,
      )}
    >
      <span className="bg-lime inline-block h-1.5 w-1.5 rounded-full" />
      UP Badminton Association · Diliman
    </span>
  );
}
