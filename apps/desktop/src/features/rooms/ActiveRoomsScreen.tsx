import { LogIn, Radio } from "lucide-react";

import { useAppStore } from "../../stores/app-store";
import {
  PageContainer,
  PageHeader,
  SectionHeader,
} from "../../components/layout/Page";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatusLabel } from "../../components/ui/StatusLabel";
import { DemoBadge } from "../../components/ui/DemoBadge";
import { RoomRow } from "../../components/room/RoomRow";

const STATE_REFERENCE = [
  {
    status: "live" as const,
    description: "Both participants are connected.",
  },
  {
    status: "waiting" as const,
    description: "One participant is connected.",
  },
  {
    status: "reconnecting" as const,
    description: "A short reconnection grace window is active.",
  },
  {
    status: "waking" as const,
    description: "The room runtime is starting.",
  },
];

export function ActiveRoomsScreen() {
  const { activeRooms, openDialog } = useAppStore();

  return (
    <PageContainer>
      <PageHeader
        title="Active rooms"
        description="Rooms with a live session in this window."
        actions={
          <>
            <DemoBadge />
            <Button
              variant="primary"
              icon={<LogIn size={15} />}
              onClick={() => openDialog({ kind: "join-room" })}
            >
              Join room
            </Button>
          </>
        }
      />

      <section aria-labelledby="active-list-heading">
        <SectionHeader
          title="Connected now"
          count={activeRooms.length}
          description="Open a room to use the local lifecycle controls."
        />

        {activeRooms.length === 0 ? (
          <EmptyState
            icon={<Radio size={17} />}
            title="No active rooms."
            description="Create a room or join with an invitation. Waiting, live and reconnecting states will appear here."
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

      <section className="mt-8 border-t border-line-subtle pt-5">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
          State reference
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {STATE_REFERENCE.map((entry) => (
            <div key={entry.status} className="flex items-start gap-3">
              <StatusLabel
                status={entry.status}
                participantCount={entry.status === "live" ? 2 : 1}
                size="sm"
                className="w-[118px] shrink-0"
              />
              <p className="min-w-0 text-[11px] leading-4 text-ink-secondary">
                {entry.description}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-4 text-ink-secondary">
          These states are local prototype transitions. No server session or
          cross-device presence is active in Sprint 1.
        </p>
      </section>
    </PageContainer>
  );
}
