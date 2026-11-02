import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-line-strong/70 bg-cream/40 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <div className="bg-cream-deep text-forest mb-3 grid h-11 w-11 place-items-center rounded-full">
          {icon}
        </div>
      )}
      <p className="font-display text-base font-bold">{title}</p>
      {description && <p className="text-muted mt-1 max-w-sm text-[13px] leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
