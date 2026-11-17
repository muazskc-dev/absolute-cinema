import {
  Archive,
  Clock,
  Loader2,
  Moon,
  RefreshCw,
  Signal,
} from "lucide-react";

import { cn } from "../../lib/cn";
import type { RoomLifecycleState } from "../../lib/rooms/types";

export type StatusValue = RoomLifecycleState | "archived";

const DESCRIPTIONS: Record<StatusValue, string> = {
  dormant:
    "Dormant rooms stay in your history and can be woken at any time.",
  waking: "The room runtime is starting.",
  waiting: "One participant is connected.",
  live: "Both participants are connected.",
  reconnecting:
    "The room is holding the session during a short reconnection window.",
  archived: "Archived rooms are hidden by default and can be restored.",
};

function labelFor(status: StatusValue, participantCount?: number): string {
  switch (status) {
    case "dormant":
      return "Dormant";
    case "waking":
      return "Waking…";
    case "waiting":
      return participantCount != null
        ? `Waiting · ${participantCount}/2`
        : "Waiting";
    case "live":
      return `Live · ${participantCount ?? 2}/2`;
    case "reconnecting":
      return "Reconnecting…";
    case "archived":
      return "Archived";
  }
}

export interface StatusLabelProps {
  status: StatusValue;
  participantCount?: number;
  size?: "sm" | "md";
  className?: string;
}

export function StatusLabel({
  status,
  participantCount,
  size = "md",
  className,
}: StatusLabelProps) {
  const iconSize = size === "sm" ? 12 : 14;
  const icon =
    status === "dormant" ? (
      <Moon size={iconSize} />
    ) : status === "waking" ? (
      <Loader2
        size={iconSize}
        className="animate-spin motion-reduce:animate-none"
      />
    ) : status === "waiting" ? (
      <Clock size={iconSize} />
    ) : status === "live" ? (
      <Signal size={iconSize} />
    ) : status === "reconnecting" ? (
      <RefreshCw
        size={iconSize}
        className="animate-spin [animation-duration:2.6s] motion-reduce:animate-none"
      />
    ) : (
      <Archive size={iconSize} />
    );

  return (
    <span
      title={DESCRIPTIONS[status]}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        size === "sm" ? "text-[11px]" : "text-[12px]",
        status === "live" ? "text-ink" : "text-ink-secondary",
        className,
      )}
    >
      <span aria-hidden className="shrink-0">
        {icon}
      </span>
      <span>{labelFor(status, participantCount)}</span>
    </span>
  );
}
