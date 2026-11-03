import { cn } from "@/lib/utils";

/**
 * A top-down badminton court drawn behind each match card. The net runs
 * vertically through the middle so the two teams sit on opposite halves, the
 * same way Queue Maestro lays out its court cards.
 */
export function CourtLines({
  className,
  tone = "live",
}: {
  className?: string;
  tone?: "live" | "suggested" | "open" | "waiting";
}) {
  // Waiting courts sit on yellow, so their lines and net are drawn in ink.
  const line =
    tone === "waiting"
      ? "rgb(10 10 10 / 0.3)"
      : tone === "open"
        ? "rgb(251 250 245 / 0.22)"
        : "rgb(251 250 245 / 0.42)";
  const net =
    tone === "waiting"
      ? "rgb(10 10 10 / 0.55)"
      : tone === "open"
        ? "rgb(255 214 0 / 0.35)"
        : "rgb(255 214 0 / 0.7)";

  return (
    <svg
      viewBox="0 0 400 220"
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      aria-hidden="true"
    >
      <g fill="none" stroke={line} strokeWidth="1.4">
        {/* doubles boundary */}
        <rect x="8" y="8" width="384" height="204" />
        {/* singles sidelines */}
        <line x1="8" y1="30" x2="392" y2="30" />
        <line x1="8" y1="190" x2="392" y2="190" />
        {/* short service lines */}
        <line x1="112" y1="8" x2="112" y2="212" />
        <line x1="288" y1="8" x2="288" y2="212" />
        {/* doubles long service lines */}
        <line x1="44" y1="8" x2="44" y2="212" />
        <line x1="356" y1="8" x2="356" y2="212" />
        {/* center lines */}
        <line x1="8" y1="110" x2="112" y2="110" />
        <line x1="288" y1="110" x2="392" y2="110" />
      </g>
      {/* net */}
      <g>
        <line x1="200" y1="2" x2="200" y2="218" stroke={net} strokeWidth="2" strokeDasharray="7 5" />
        <circle cx="200" cy="6" r="3" fill={net} />
        <circle cx="200" cy="214" r="3" fill={net} />
      </g>
    </svg>
  );
}
