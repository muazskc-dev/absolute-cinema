import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface-1 px-1.5 font-mono text-[10px] leading-none text-ink-secondary">
      {children}
    </kbd>
  );
}

export function Separator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      className={cn("h-px w-full bg-line-subtle", className)}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("ac-skeleton rounded-md bg-surface-2", className)}
    />
  );
}
