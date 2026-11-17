import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "../../lib/cn";

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional = false,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-[12px] font-medium tracking-[0.005em] text-ink"
        >
          {label}
        </label>
        {optional ? (
          <span className="text-[11px] text-ink-secondary">Optional</span>
        ) : null}
      </div>
      {children}
      {hint && !error ? (
        <p className="text-[11px] leading-4 text-ink-secondary">{hint}</p>
      ) : null}
      {error ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-4 text-ink">
          <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
