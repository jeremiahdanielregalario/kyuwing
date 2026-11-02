import { cn } from "@/lib/utils";
import { levelLabel, levelTone } from "@/lib/levels";

export function LevelBadge({ level, className }: { level: string; className?: string }) {
  const tone = levelTone(level);
  return (
    <span
      className={cn(
        "inline-flex min-w-8 items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold ring-1 ring-inset",
        tone.bg,
        tone.text,
        tone.ring,
        className,
      )}
      title={`Level ${levelLabel(level)}`}
    >
      {levelLabel(level)}
    </span>
  );
}

export function CategoryBadge({ category }: { category: "ACTIVE" | "ALUMNI" | "APPLICANT" | string }) {
  const label = category === "ALUMNI" ? "Alumni" : category === "APPLICANT" ? "Applicant" : "Active";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        category === "ACTIVE"
          ? "bg-emerald-100 text-emerald-800"
          : category === "ALUMNI"
            ? "bg-amber-100 text-amber-900"
            : "bg-sky-100 text-sky-900",
      )}
    >
      {label}
    </span>
  );
}
