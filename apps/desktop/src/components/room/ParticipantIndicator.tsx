import { User } from "lucide-react";

import { cn } from "../../lib/cn";

export interface ParticipantIndicatorProps {
  count: number;
  size?: "sm" | "md";
  className?: string;
}

export function ParticipantIndicator({
  count,
  size = "md",
  className,
}: ParticipantIndicatorProps) {
  const slot = size === "sm" ? "size-4" : "size-5";
  const icon = size === "sm" ? 10 : 11;

  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      aria-label={`${count} of 2 participants connected`}
      title={`${count} of 2 participants connected`}
    >
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1].map((index) => (
          <span
            key={index}
            className={cn(
              "grid place-items-center rounded-full border",
              slot,
              index < count
                ? "border-[#a1a1aa] bg-surface-2 text-ink"
                : "border-line text-ink-muted",
            )}
          >
            <User size={icon} />
          </span>
        ))}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-ink-secondary">
        {count} / 2
      </span>
    </div>
  );
}
