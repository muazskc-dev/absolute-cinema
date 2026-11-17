import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";
import { Tooltip } from "./Tooltip";

type IconButtonSize = "sm" | "md";
type IconButtonVariant = "ghost" | "secondary" | "plain";

const SIZES: Record<IconButtonSize, string> = {
  sm: "size-7 rounded-md",
  md: "size-8 rounded-md",
};

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost:
    "border-transparent bg-transparent text-ink-secondary hover:bg-surface-2 hover:text-ink active:bg-surface-3",
  secondary:
    "border-line bg-surface-2 text-ink-secondary hover:border-[#3a3a3a] hover:text-ink",
  plain:
    "border-transparent bg-transparent text-ink-secondary hover:text-ink",
};

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
  icon: ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  tooltip?: boolean;
  tooltipSide?: "top" | "bottom" | "right";
}

export function IconButton({
  label,
  icon,
  size = "md",
  variant = "ghost",
  tooltip = true,
  tooltipSide = "top",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid select-none place-items-center border transition-[background-color,border-color,color,transform] duration-100 ease-out active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );

  if (!tooltip) return button;
  return (
    <Tooltip label={label} side={tooltipSide}>
      {button}
    </Tooltip>
  );
}
