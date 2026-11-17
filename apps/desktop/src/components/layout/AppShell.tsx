import { useEffect, useRef } from "react";

import { useAppStore } from "../../stores/app-store";
import { useMediaQuery } from "../../hooks/use-media-query";
import { HomeScreen } from "../../features/home/HomeScreen";
import { ActiveRoomsScreen } from "../../features/rooms/ActiveRoomsScreen";
import { RoomHistoryScreen } from "../../features/history/RoomHistoryScreen";
import { RoomScreen } from "../../features/rooms/RoomScreen";
import { SettingsScreen } from "../../features/settings/SettingsScreen";
import { MediaLab } from "../../features/lab/MediaLab";
import { AppHeader } from "./AppHeader";
import { Sidebar } from "./Sidebar";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function AppShell() {
  const { view, preferences, updatePreferences, dialog } = useAppStore();
  const narrow = useMediaQuery("(max-width: 1179px)");
  const collapsed = narrow || preferences.sidebarCollapsed;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== "b") return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      if (narrow) return;
      updatePreferences({
        sidebarCollapsed: !preferences.sidebarCollapsed,
      });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [narrow, preferences.sidebarCollapsed, updatePreferences]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [view.kind, view.kind === "room" ? view.roomId : null]);

  const page =
    view.kind === "home" ? (
      <HomeScreen />
    ) : view.kind === "active" ? (
      <ActiveRoomsScreen />
    ) : view.kind === "history" ? (
      <RoomHistoryScreen />
    ) : view.kind === "settings" ? (
      <SettingsScreen section={view.section} />
    ) : view.kind === "lab" ? (
      <MediaLab />
    ) : (
      <RoomScreen roomId={view.roomId} />
    );

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-md focus:border focus:border-line focus:bg-surface-2 focus:px-3 focus:py-2 focus:text-[12px] focus:text-ink"
      >
        Skip to main content
      </a>

      <AppHeader collapsed={collapsed} />

      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} narrow={narrow} />

        <main
          id="main-content"
          aria-label="Workspace"
          data-dialog-open={dialog != null ? "true" : undefined}
          className="relative min-w-0 flex-1 overflow-hidden"
        >
          {view.kind === "room" ? (
            page
          ) : (
            <div ref={scrollRef} className="h-full overflow-y-auto">
              {page}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
