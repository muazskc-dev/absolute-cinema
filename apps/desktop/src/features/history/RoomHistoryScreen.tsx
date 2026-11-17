import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { cn } from "../../lib/cn";
import type { RoomLifecycleState } from "../../lib/rooms/types";
import { useAppStore } from "../../stores/app-store";
import { PageContainer, PageHeader } from "../../components/layout/Page";
import { Button } from "../../components/ui/Button";
import { DemoBadge } from "../../components/ui/DemoBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import {
  HISTORY_ROW_GRID,
  RoomRow,
} from "../../components/room/RoomRow";

type StatusFilter = "all" | RoomLifecycleState;
type SortOrder = "activity" | "name";

export function RoomHistoryScreen() {
  const { rooms, preferences, openDialog } = useAppStore();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [protectedOnly, setProtectedOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(
    preferences.showArchivedByDefault,
  );
  const [sort, setSort] = useState<SortOrder>("activity");

  const availableRooms = useMemo(
    () => rooms.filter((room) => showArchived || !room.archived),
    [rooms, showArchived],
  );

  const filteredRooms = useMemo(() => {
    const term = search.trim().toLowerCase();
    return availableRooms
      .filter((room) => status === "all" || room.status === status)
      .filter((room) => !protectedOnly || room.isPasswordProtected)
      .filter((room) => {
        if (!term) return true;
        return (
          room.name.toLowerCase().includes(term) ||
          (room.partnerDisplayName ?? "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : b.lastActiveAt.localeCompare(a.lastActiveAt),
      );
  }, [availableRooms, protectedOnly, search, sort, status]);

  const dormantCount = rooms.filter(
    (room) => room.status === "dormant" && !room.archived,
  ).length;
  const archivedCount = rooms.filter((room) => room.archived).length;

  const hasFilters =
    search.trim().length > 0 ||
    status !== "all" ||
    protectedOnly ||
    showArchived !== preferences.showArchivedByDefault ||
    sort !== "activity";

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setProtectedOnly(false);
    setShowArchived(preferences.showArchivedByDefault);
    setSort("activity");
  };

  return (
    <PageContainer>
      <PageHeader
        title="Room history"
        description="Your previous cinema spaces. Dormant rooms stay here until you delete them."
        actions={
          <>
            <DemoBadge />
            <Button
              variant="primary"
              icon={<Plus size={15} />}
              onClick={() => openDialog({ kind: "create-room" })}
            >
              New room
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-[220px] flex-1">
          <Input
            aria-label="Search rooms"
            placeholder="Search rooms or partners"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            leading={<Search size={14} />}
          />
        </div>

        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          wrapperClassName="w-[158px] shrink-0"
        >
          <option value="all">All statuses</option>
          <option value="live">Live</option>
          <option value="waiting">Waiting</option>
          <option value="reconnecting">Reconnecting</option>
          <option value="waking">Waking</option>
          <option value="dormant">Dormant</option>
        </Select>

        <Select
          aria-label="Sort rooms"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOrder)}
          wrapperClassName="w-[148px] shrink-0"
        >
          <option value="activity">Last active</option>
          <option value="name">Name</option>
        </Select>

        <div className="flex h-10 items-center gap-2">
          <Switch
            label="Protected only"
            checked={protectedOnly}
            onCheckedChange={setProtectedOnly}
          />
          <span className="text-[11px] text-ink-secondary">Protected only</span>
        </div>

        <div className="flex h-10 items-center gap-2">
          <Switch
            label="Show archived rooms"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <span className="text-[11px] text-ink-secondary">
            Archived{archivedCount > 0 ? ` (${archivedCount})` : ""}
          </span>
        </div>
      </div>

      <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-ink-secondary">
          Showing {filteredRooms.length} of {availableRooms.length}{" "}
          {availableRooms.length === 1 ? "room" : "rooms"} · {dormantCount}{" "}
          dormant
        </p>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-line-subtle">
        <div
          className={cn(
            "grid items-center gap-4 border-b border-line bg-surface-1 px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-secondary",
            HISTORY_ROW_GRID,
          )}
        >
          <span>Room</span>
          <span>Status</span>
          <span>Last active</span>
          <span>Access</span>
          <span className="sr-only">Actions</span>
        </div>

        {filteredRooms.length === 0 ? (
          <EmptyState
            icon={<Search size={17} />}
            title={
              rooms.length === 0
                ? "No rooms in your history yet."
                : "No rooms match these filters."
            }
            description={
              rooms.length === 0
                ? "Create your first private room. It stays in history after the session ends."
                : "Adjust the search, status or archive filters to see more rooms."
            }
            action={
              rooms.length === 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => openDialog({ kind: "create-room" })}
                >
                  Create room
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          filteredRooms.map((room) => (
            <RoomRow key={room.id} room={room} variant="history" />
          ))
        )}
      </div>

      <p className="mt-4 text-[11px] leading-4 text-ink-secondary">
        Dormant rooms are persistent records, not deleted sessions. This
        prototype keeps the list in memory for the current window; server
        persistence arrives in Sprint 2.
      </p>
    </PageContainer>
  );
}
