import { LogIn, Moon, Plus, Radio } from "lucide-react";

import { useAppStore } from "../../stores/app-store";
import {
  PageContainer,
  PageHeader,
  SectionHeader,
} from "../../components/layout/Page";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { RoomRow } from "../../components/room/RoomRow";

export function HomeScreen() {
  const { activeRooms, recentRooms, openDialog, navigate } = useAppStore();

  return (
    <PageContainer>
      <PageHeader
        title="Your cinema"
        description="Your private spaces, ready when you are."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<LogIn size={15} />}
              onClick={() => openDialog({ kind: "join-room" })}
            >
              Join room
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={15} />}
              onClick={() => openDialog({ kind: "create-room" })}
            >
              Create room
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-x-6 gap-y-8 min-[1180px]:grid-cols-[1.618fr_1fr]">
        <section aria-labelledby="active-rooms-heading">
          <SectionHeader
            id="active-rooms-heading"
            title="Active now"
            count={activeRooms.length}
            action={
              activeRooms.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ kind: "active" })}
                >
                  View all
                </Button>
              ) : undefined
            }
          />

          {activeRooms.length === 0 ? (
            <EmptyState
              icon={<Radio size={17} />}
              title="No one is in a room right now."
              description="Create a private room or join with an invitation from the other participant."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<LogIn size={14} />}
                  onClick={() => openDialog({ kind: "join-room" })}
                >
                  Join a room
                </Button>
              }
              className="rounded-lg border border-line-subtle"
            />
          ) : (
            <div className="border-y border-line-subtle">
              {activeRooms.map((room) => (
                <RoomRow key={room.id} room={room} variant="active" />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="recent-rooms-heading">
          <SectionHeader
            id="recent-rooms-heading"
            title="Recent rooms"
            count={recentRooms.length}
            action={
              recentRooms.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ kind: "history" })}
                >
                  Show all
                </Button>
              ) : undefined
            }
          />

          {recentRooms.length === 0 ? (
            <EmptyState
              compact
              icon={<Moon size={17} />}
              title="No rooms in your history yet."
              description="Create your first private room. It stays in history after the session ends."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => openDialog({ kind: "create-room" })}
                >
                  Create room
                </Button>
              }
              className="rounded-lg border border-line-subtle"
            />
          ) : (
            <div className="flex flex-col gap-0.5">
              {recentRooms.slice(0, 4).map((room) => (
                <RoomRow key={room.id} room={room} variant="compact" />
              ))}
            </div>
          )}

          <p className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-ink-secondary">
            <Moon size={12} className="mt-0.5 shrink-0" aria-hidden />
            Dormant rooms stay in your history and can be woken at any time.
          </p>
        </section>
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-4 text-[11px] text-ink-secondary">
        <span>Demo rooms live in this window and reset when the app closes.</span>
        <span className="font-mono text-[10px]">Two people · one room</span>
      </footer>
    </PageContainer>
  );
}
