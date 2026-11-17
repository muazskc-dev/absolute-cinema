import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
  wrapperClassName?: string;
}

export function Input({
  leading,
  trailing,
  invalid = false,
  className,
  wrapperClassName,
  disabled,
  ...props
}: InputProps) {
  return (
    <div
      className={cn(
        "flex h-10 items-center gap-2 rounded-md border bg-surface-1 px-3 transition-[border-color,box-shadow] duration-100",
        invalid ? "border-[#4a4a4a]" : "border-line",
        "focus-within:ring-2 focus-within:ring-white/90 focus-within:ring-offset-2 focus-within:ring-offset-canvas",
        disabled && "opacity-50",
        wrapperClassName,
      )}
    >
      {leading ? (
        <span className="shrink-0 text-ink-muted" aria-hidden>
          {leading}
        </span>
      ) : null}
      <input
        disabled={disabled}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-secondary disabled:cursor-not-allowed",
          className,
        )}
        spellCheck={false}
        {...props}
      />
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </div>
  );
}
