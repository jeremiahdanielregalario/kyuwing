import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-muted mb-1.5 block text-xs font-semibold tracking-[0.12em] uppercase", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "border-line text-ink placeholder:text-muted/60 focus:border-forest/50 focus:ring-lime/60 disabled:bg-cream-deep disabled:text-muted h-11 w-full rounded-xl border bg-white px-3.5 text-sm shadow-inner shadow-black/[0.02] transition-colors focus:ring-2 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "border-line text-ink focus:border-forest/50 focus:ring-lime/60 disabled:bg-cream-deep disabled:text-muted h-11 w-full appearance-none rounded-xl border bg-white px-3.5 pr-9 text-sm transition-colors focus:ring-2 focus:outline-none",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236f7f75' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "border-line text-ink placeholder:text-muted/60 focus:border-forest/50 focus:ring-lime/60 disabled:bg-cream-deep disabled:text-muted w-full rounded-xl border bg-white px-3.5 py-3 text-sm transition-colors focus:ring-2 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-coral mt-1 text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted mt-1 text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("border-line text-forest accent-forest focus:ring-forest h-4 w-4 rounded", className)}
      {...props}
    />
  );
}
