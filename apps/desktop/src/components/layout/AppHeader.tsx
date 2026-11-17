import { Lock } from "lucide-react";

import { cn } from "../../lib/cn";
import { useAppStore } from "../../stores/app-store";
import { StatusLabel } from "../ui/StatusLabel";

export interface AppHeaderProps {
  collapsed: boolean;
}

export function AppHeader({ collapsed }: AppHeaderProps) {
  const { view, rooms } = useAppStore();

  const room =
    view.kind === "room"
      ? rooms.find((candidate) => candidate.id === view.roomId)
      : undefined;

  const title =
    view.kind === "home"
      ? "Home"
      : view.kind === "active"
        ? "Active rooms"
        : view.kind === "history"
          ? "Room history"
          : view.kind === "settings"
            ? "Settings"
            : view.kind === "lab"
              ? "Developer lab"
              : (room?.name ?? "Room unavailable");

  return (
    <header className="flex h-[52px] shrink-0 items-stretch border-b border-line bg-sidebar">
      <div
        className={cn(
          "flex shrink-0 items-center border-r border-line-subtle transition-[width] duration-150 ease-out",
          collapsed ? "w-16 justify-center" : "w-56 px-4",
        )}
      >
        {collapsed ? (
          <span
            className="font-mono text-[11px] font-medium tracking-[0.14em] text-ink"
            title="ABSOLUTE-CINEMA"
          >
            AC
          </span>
        ) : (
          <div className="min-w-0">
            <p className="truncate text-[11px] font-[550] uppercase leading-4 tracking-[0.18em] text-ink">
              Absolute-cinema
            </p>
            <p className="truncate text-[10px] uppercase leading-3 tracking-[0.16em] text-ink-muted">
              Private cinema
            </p>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-between gap-4 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-[12px] text-ink-secondary">{title}</span>
          {room ? (
            <>
              <span aria-hidden className="h-3 w-px shrink-0 bg-line" />
              <StatusLabel
                status={room.archived ? "archived" : room.status}
                participantCount={room.participantCount}
                size="sm"
              />
              {room.isPasswordProtected ? (
                <Lock
                  size={12}
                  className="shrink-0 text-ink-muted"
                  aria-label="Password protected"
                />
              ) : null}
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-ink-muted sm:inline-flex">
            <span
              aria-hidden
              className="size-1 rounded-full border border-[#777]"
            />
            Local prototype
          </span>
        </div>
      </div>
    </header>
  );
}
