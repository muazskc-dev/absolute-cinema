import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

const POSITIONS = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
} as const;

export interface TooltipProps {
  label: string;
  side?: keyof typeof POSITIONS;
  children: ReactNode;
}

export function Tooltip({ label, side = "top", children }: TooltipProps) {
  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-[70] whitespace-nowrap rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-normal normal-case tracking-normal text-ink opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.55)] transition-opacity duration-100 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          POSITIONS[side],
        )}
      >
        {label}
      </span>
    </span>
  );
}
