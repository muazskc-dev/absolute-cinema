import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-12",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 grid size-9 place-items-center rounded-lg border border-line-subtle bg-surface-1 text-ink-secondary">
          {icon}
        </div>
      ) : null}
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-[340px] text-[12px] leading-5 text-ink-secondary">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
