import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function Notice({
  icon,
  title,
  children,
  className,
}: {
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border border-line bg-surface-1 px-3 py-2.5 text-[11px] leading-5 text-ink-secondary",
        className,
      )}
    >
      {icon ? (
        <span className="mt-0.5 shrink-0 text-ink-secondary" aria-hidden>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        {title ? (
          <p className="text-[12px] font-medium text-ink">{title}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
