import type { ComponentPropsWithRef, ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-ink text-canvas hover:bg-white active:bg-[#e8e8e8]",
  secondary:
    "border-line bg-surface-2 text-ink hover:border-[#3a3a3a] hover:bg-surface-3 active:bg-[#1c1c1c]",
  ghost:
    "border-transparent bg-transparent text-ink-secondary hover:bg-surface-2 hover:text-ink active:bg-surface-3",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-md px-2.5 text-[12px]",
  md: "h-9 gap-2 rounded-md px-3.5 text-[13px]",
  lg: "h-10 gap-2 rounded-md px-4 text-[13px]",
};

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  trailingIcon,
  fullWidth = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center border font-medium tracking-[-0.005em] transition-[background-color,border-color,color,transform] duration-100 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
      {trailingIcon}
    </button>
  );
}
