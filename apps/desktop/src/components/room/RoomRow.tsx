import {
  ArchiveRestore,
  ArrowUpRight,
  Clapperboard,
  Lock,
  Sunrise,
  type LucideIcon,
} from "lucide-react";

import { cn } from "../../lib/cn";
import {
  formatDateTime,
  formatRelativeTime,
} from "../../lib/format";
import type { RoomSummary } from "../../lib/rooms/types";
import { useAppStore } from "../../stores/app-store";
import { Button } from "../ui/Button";
import { ParticipantIndicator } from "./ParticipantIndicator";
import { RoomActionMenu } from "./RoomActionMenu";
import { RoomStatus } from "./RoomStatus";

export const HISTORY_ROW_GRID =
  "grid-cols-[minmax(0,1fr)_132px_112px_auto_auto]";

export type RoomRowVariant = "active" | "history" | "compact";

export interface RoomRowProps {
  room: RoomSummary;
  variant?: RoomRowVariant;
  className?: string;
}

function metaFor(room: RoomSummary): string {
  const partner = room.partnerDisplayName
    ? `With ${room.partnerDisplayName}`
    : "No partner yet";
  const activity = formatRelativeTime(room.lastActiveAt);
  const media = room.lastMediaLabel ? ` · ${room.lastMediaLabel}` : "";
  return `${partner} · ${activity}${media}`;
}

function actionFor(room: RoomSummary): {
  label: string;
  icon: LucideIcon;
} {
  if (room.archived) {
    return { label: "Restore", icon: ArchiveRestore };
  }
  if (room.status === "dormant") {
    return { label: "Wake", icon: Sunrise };
  }
  return { label: "Open", icon: ArrowUpRight };
}

function RoomGlyph({ size = 16 }: { size?: number }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line-subtle bg-surface-1 text-ink-secondary">
      <Clapperboard size={size} aria-hidden />
    </span>
  );
}

export function RoomRow({
  room,
  variant = "history",
  className,
}: RoomRowProps) {
  const { openRoom, unarchiveRoom } = useAppStore();
  const action = actionFor(room);
  const ActionIcon = action.icon;
  const run =
    room.archived
      ? () => unarchiveRoom(room.id)
      : () => openRoom(room.id);

  if (variant === "compact") {
    return (
      <article
        className={cn(
          "group flex min-h-[56px] items-center gap-2 rounded-md px-2 py-2 transition-colors duration-100 hover:bg-surface-1 focus-within:bg-surface-1",
          className,
        )}
      >
        <RoomGlyph size={14} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate text-[12px] font-medium text-ink">
              {room.name}
            </h3>
            {room.isPasswordProtected ? (
              <Lock
                size={10}
                className="shrink-0 text-ink-muted"
                aria-label="Password protected"
              />
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[10px] text-ink-secondary">
            {formatRelativeTime(room.lastActiveAt)}
          </p>
        </div>
        <RoomStatus room={room} size="sm" className="shrink-0" />
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 px-2"
          icon={<ActionIcon size={13} />}
          onClick={run}
        >
          {action.label}
        </Button>
        <RoomActionMenu room={room} />
      </article>
    );
  }

  if (variant === "active") {
    return (
      <article
        className={cn(
          "group flex min-h-[72px] items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors duration-100 hover:border-line-subtle hover:bg-surface-1 focus-within:border-line-subtle focus-within:bg-surface-1",
          className,
        )}
      >
        <RoomGlyph />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-[13px] font-medium text-ink">
              {room.name}
            </h3>
            {room.isPasswordProtected ? (
              <Lock
                size={12}
                className="shrink-0 text-ink-muted"
                aria-label="Password protected"
              />
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-ink-secondary">
            {metaFor(room)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <RoomStatus room={room} size="sm" />
          <ParticipantIndicator count={room.participantCount} size="sm" />
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          icon={<ActionIcon size={13} />}
          onClick={run}
        >
          {action.label}
        </Button>
        <RoomActionMenu room={room} />
      </article>
    );
  }

  return (
    <article
      className={cn(
        "group grid min-h-[72px] items-center gap-4 border-b border-line-subtle px-3 py-2.5 transition-colors duration-100 last:border-b-0 hover:bg-surface-1 focus-within:bg-surface-1",
        HISTORY_ROW_GRID,
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <RoomGlyph />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-[13px] font-medium text-ink">
              {room.name}
            </h3>
            {room.isPasswordProtected ? (
              <Lock
                size={12}
                className="shrink-0 text-ink-muted"
                aria-label="Password protected"
              />
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-ink-secondary">
            {metaFor(room)}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <RoomStatus room={room} />
      </div>

      <span
        className="truncate font-mono text-[11px] text-ink-secondary"
        title={formatDateTime(room.lastActiveAt)}
      >
        {formatRelativeTime(room.lastActiveAt)}
      </span>

      <Button
        size="sm"
        variant="secondary"
        className="shrink-0"
        icon={<ActionIcon size={13} />}
        onClick={run}
      >
        {action.label}
      </Button>

      <RoomActionMenu room={room} />
    </article>
  );
}
