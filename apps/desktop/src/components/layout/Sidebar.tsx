import type { ReactNode } from "react";
import {
  ArrowRight,
  FlaskConical,
  History,
  Home,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radio,
  Settings,
  User,
} from "lucide-react";

import { cn } from "../../lib/cn";
import { useAppStore } from "../../stores/app-store";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Separator } from "../ui/Primitives";

export interface SidebarProps {
  collapsed: boolean;
  narrow: boolean;
}

interface SidebarRowProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  badge?: string;
}

function SidebarRow({
  icon,
  label,
  active = false,
  collapsed,
  onClick,
  disabled = false,
  title,
  badge,
}: SidebarRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={title ?? label}
      className={cn(
        "relative flex h-9 w-full items-center gap-2.5 rounded-md text-[12px] transition-colors duration-100 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-45",
        collapsed ? "justify-center px-0" : "px-2.5",
        active
          ? "bg-surface-2 text-ink"
          : "text-ink-secondary hover:bg-surface-1 hover:text-ink",
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-ink"
        />
      ) : null}
      <span className="grid size-4 shrink-0 place-items-center">{icon}</span>
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          {badge ? (
            <span className="rounded border border-line-subtle px-1 py-px text-[10px] uppercase tracking-[0.08em] text-ink-muted">
              {badge}
            </span>
          ) : null}
        </>
      ) : null}
    </button>
  );
}

export function Sidebar({ collapsed, narrow }: SidebarProps) {
  const {
    view,
    rooms,
    preferences,
    updatePreferences,
    navigate,
    openRoom,
    openDialog,
  } = useAppStore();

  const recents = [...rooms]
    .filter((room) => !room.archived)
    .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
    .slice(0, 4);

  const currentRoom =
    view.kind === "room"
      ? rooms.find((candidate) => candidate.id === view.roomId)
      : undefined;

  const activeSelected =
    view.kind === "active" ||
    (view.kind === "room" && currentRoom != null && currentRoom.status !== "dormant" && !currentRoom.archived);
  const historySelected =
    view.kind === "history" ||
    (view.kind === "room" &&
      (currentRoom == null || currentRoom.status === "dormant" || currentRoom.archived));

  const toggleCollapsed = () => {
    if (narrow) return;
    updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed });
  };

  return (
    <aside
      aria-label="Application navigation"
      className={cn(
        "flex shrink-0 flex-col border-r border-line bg-sidebar transition-[width] duration-150 ease-out",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className={cn("shrink-0", collapsed ? "px-2 pb-2 pt-3" : "px-3 pb-2 pt-3")}>
        {collapsed ? (
          <IconButton
            label="New room"
            icon={<Plus size={18} />}
            variant="secondary"
            tooltipSide="right"
            onClick={() => openDialog({ kind: "create-room" })}
            className="size-10"
          />
        ) : (
          <Button
            variant="primary"
            size="md"
            fullWidth
            icon={<Plus size={15} />}
            onClick={() => openDialog({ kind: "create-room" })}
          >
            New room
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3">
        {collapsed ? (
          <Separator className="my-2" />
        ) : (
          <p className="px-2.5 pb-1.5 pt-3 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            Home
          </p>
        )}

        <nav aria-label="Primary" className="flex flex-col gap-0.5">
          <SidebarRow
            icon={<Home size={16} />}
            label="Home"
            collapsed={collapsed}
            active={view.kind === "home"}
            onClick={() => navigate({ kind: "home" })}
          />
          <SidebarRow
            icon={<Radio size={16} />}
            label="Active rooms"
            collapsed={collapsed}
            active={activeSelected}
            onClick={() => navigate({ kind: "active" })}
          />
          <SidebarRow
            icon={<History size={16} />}
            label="Room history"
            collapsed={collapsed}
            active={historySelected}
            onClick={() => navigate({ kind: "history" })}
          />
        </nav>

        {!collapsed ? (
          <section aria-label="Recent rooms" className="mt-4">
            <p className="px-2.5 pb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              Recent rooms
            </p>
            {recents.length === 0 ? (
              <p className="px-2.5 py-1 text-[11px] text-ink-muted">
                No recent rooms
              </p>
            ) : (
              <div className="flex flex-col gap-px">
                {recents.map((room) => {
                  const selected =
                    view.kind === "room" && view.roomId === room.id;
                  const dot =
                    room.status === "live"
                      ? "bg-white"
                      : room.status === "waiting" || room.status === "waking"
                        ? "border border-[#a1a1aa]"
                        : room.status === "reconnecting"
                          ? "border border-[#a1a1aa] bg-surface-3"
                          : "border border-[#777]";
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => openRoom(room.id)}
                      title={`${room.name} — ${room.status}`}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[12px] transition-colors duration-100",
                        selected
                          ? "bg-surface-2 text-ink"
                          : "text-ink-secondary hover:bg-surface-1 hover:text-ink",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn("size-1.5 shrink-0 rounded-full", dot)}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {room.name}
                      </span>
                      {room.isPasswordProtected ? (
                        <Lock
                          size={11}
                          className="shrink-0 text-ink-muted"
                          aria-label="Password protected"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate({ kind: "history" })}
              className="mt-1 flex h-7 w-full items-center gap-1.5 rounded-md px-2.5 text-[11px] text-ink-muted transition-colors duration-100 hover:bg-surface-1 hover:text-ink-secondary"
            >
              Show all
              <ArrowRight size={11} aria-hidden />
            </button>
          </section>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-line-subtle p-2">
        <SidebarRow
          icon={<Settings size={16} />}
          label="Settings"
          collapsed={collapsed}
          active={view.kind === "settings"}
          onClick={() => navigate({ kind: "settings" })}
        />
        <SidebarRow
          icon={<FlaskConical size={16} />}
          label="Developer lab"
          collapsed={collapsed}
          active={view.kind === "lab"}
          onClick={() => navigate({ kind: "lab" })}
        />
        <SidebarRow
          icon={<User size={16} />}
          label="Profile"
          badge="Local"
          collapsed={collapsed}
          disabled
          title="Local profile arrives with accounts"
        />

        <Separator className="my-2" />

        {collapsed ? (
          <IconButton
            label={narrow ? "Sidebar collapsed automatically" : "Expand sidebar"}
            icon={<PanelLeftOpen size={16} />}
            tooltip={false}
            disabled={narrow}
            title={
              narrow
                ? "Sidebar collapses automatically at this window width"
                : "Expand sidebar (Ctrl+B)"
            }
            onClick={toggleCollapsed}
            className="mx-auto"
          />
        ) : (
          <button
            type="button"
            onClick={toggleCollapsed}
            disabled={narrow}
            title={
              narrow
                ? "Sidebar collapses automatically at this window width"
                : "Collapse sidebar (Ctrl+B)"
            }
            className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[11px] text-ink-muted transition-colors duration-100 hover:bg-surface-1 hover:text-ink-secondary disabled:cursor-not-allowed disabled:opacity-45"
          >
            <PanelLeftClose size={16} aria-hidden />
            <span>Collapse sidebar</span>
            <span className="ml-auto font-mono text-[10px]">Ctrl B</span>
          </button>
        )}
      </div>
    </aside>
  );
}
