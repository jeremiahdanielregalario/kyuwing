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

export function CategoryBadge({ category }: { category: "ACTIVE" | "INACTIVE" | "ALUMNI" | "APPLICANT" | string }) {
  const label = 
    category === "INACTIVE" ? "Inactive" :
    category === "ALUMNI" ? "Alumni" : 
    category === "APPLICANT" ? "Applicant" : 
    "Active";
  const tone = 
    category === "ACTIVE" ? { bg: "bg-emerald-100", text: "text-emerald-800" } :
    category === "INACTIVE" ? { bg: "bg-amber-100", text: "text-amber-900" } :
    category === "ALUMNI" ? { bg: "bg-orange-100", text: "text-orange-900" } :
    { bg: "bg-sky-100", text: "text-sky-900" };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        tone.bg,
        tone.text,
      )}
    >
      {label}
    </span>
  );
}
