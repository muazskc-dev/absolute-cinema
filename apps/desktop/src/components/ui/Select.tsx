import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "../../lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

export function Select({
  className,
  wrapperClassName,
  children,
  ...props
}: SelectProps) {
  return (
    <div
      className={cn(
        "relative flex h-10 items-center rounded-md border border-line bg-surface-1 transition-[border-color] duration-100 focus-within:border-[#3a3a3a] focus-within:ring-2 focus-within:ring-white/90 focus-within:ring-offset-2 focus-within:ring-offset-canvas",
        wrapperClassName,
      )}
    >
      <select
        className={cn(
          "h-full w-full appearance-none bg-transparent pl-3 pr-8 text-[13px] text-ink outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 text-ink-muted"
        aria-hidden
      />
    </div>
  );
}
