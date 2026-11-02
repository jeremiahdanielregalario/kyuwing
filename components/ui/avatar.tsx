import { cn } from "@/lib/utils";

export function Avatar({
  name,
  level,
  size = "md",
  className,
}: {
  name: string;
  level?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const colors = [
    "bg-emerald-100 text-emerald-800",
    "bg-amber-100 text-amber-900",
    "bg-sky-100 text-sky-900",
    "bg-rose-100 text-rose-800",
    "bg-lime-100 text-lime-900",
    "bg-violet-100 text-violet-900",
  ];
  const index = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;
  return (
    <span
      className={cn(
        "font-display relative grid shrink-0 place-items-center rounded-full font-bold",
        colors[index],
        {
          sm: "h-7 w-7 text-[10px]",
          md: "h-9 w-9 text-xs",
          lg: "h-11 w-11 text-sm",
        }[size],
        className,
      )}
      aria-hidden="true"
    >
      {name.slice(0, 2).toUpperCase()}
      {level && (
        <span className="bg-paper text-ink ring-line absolute -right-1 -bottom-1 rounded px-1 font-mono text-[8px] leading-4 font-bold ring-1">
          {level}
        </span>
      )}
    </span>
  );
}
