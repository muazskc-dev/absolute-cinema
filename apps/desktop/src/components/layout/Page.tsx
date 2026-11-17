import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function PageContainer({
  children,
  className,
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-8 py-8 max-[1179px]:px-6 max-[1179px]:py-6",
        wide ? "max-w-[1180px]" : "max-w-[1000px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-6",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[26px] font-[550] leading-[1.2] tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-[560px] text-[13px] leading-5 text-ink-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 pb-0.5">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export interface SectionHeaderProps {
  id?: string;
  title: string;
  count?: number;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({
  id,
  title,
  count,
  description,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-3 flex items-end justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h2
            id={id}
            className="text-[14px] font-[550] tracking-[-0.005em] text-ink"
          >
            {title}
          </h2>
          {count != null ? (
            <span className="font-mono text-[11px] text-ink-secondary">
              {count}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-0.5 text-[11px] leading-4 text-ink-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
