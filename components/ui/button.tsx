import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "accent" | "outline" | "ghost" | "danger" | "paper" | "dark";
type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-forest text-cream shadow-[0_10px_24px_-14px_rgba(6,37,28,0.8)] hover:bg-forest-deep",
    accent: "bg-lime text-ink shadow-[0_10px_24px_-16px_rgba(159,214,58,0.9)] hover:bg-lime-bright",
    outline: "border border-line-strong bg-transparent text-ink hover:border-forest hover:bg-paper",
    ghost: "text-ink-soft hover:bg-cream-deep hover:text-ink",
    danger: "bg-coral text-white hover:bg-[#e95536]",
    paper: "border border-line bg-paper text-ink shadow-sm hover:border-forest/40 hover:bg-white",
    dark: "bg-forest-deep text-cream hover:bg-forest",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "h-9 px-3.5 text-[13px]",
    md: "h-11 px-5 text-sm",
    lg: "h-13 px-6 text-[15px]",
    icon: "h-11 w-11",
    "icon-sm": "h-9 w-9",
  };

  return cn(
    "press focus-visible:outline-forest inline-flex items-center justify-center gap-2 rounded-full font-semibold select-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={buttonVariants({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
