import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { ArchiveRestore, Moon, Sun, Unplug } from "lucide-react";

import { useAppStore } from "../../stores/app-store";
import { PageContainer } from "../../components/layout/Page";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Notice } from "../../components/ui/Notice";
import { ChatDrawer } from "../chat/ChatDrawer";
import { VoicePanel } from "../voice/VoicePanel";
import { CinemaRoom } from "../player/CinemaRoom";
import { WaitingRoom } from "./WaitingRoom";

export function RoomScreen({ roomId }: { roomId: string }) {
  const { rooms, navigate, wakeRoom, unarchiveRoom } = useAppStore();
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const room = rooms.find((candidate) => candidate.id === roomId);

  if (!room) {
    return (
      <PageContainer>
        <EmptyState
          icon={<Unplug size={17} />}
          title="This room is unavailable."
          description="It may have been deleted from local history in this window."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate({ kind: "history" })}
            >
              Back to Room history
            </Button>
          }
          className="mt-10 rounded-xl border border-line-subtle"
        />
      </PageContainer>
    );
  }

  if (room.archived) {
    return (
      <PageContainer>
        <div className="mt-8 flex flex-col gap-4">
          <Notice icon={<ArchiveRestore size={14} />} title="Room archived">
            Archived rooms stay recoverable. Restore {room.name} before opening
            it again.
          </Notice>
          <div>
            <Button
              variant="primary"
              icon={<ArchiveRestore size={15} />}
              onClick={() => unarchiveRoom(room.id)}
            >
              Restore room
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (room.status === "dormant") {
    return (
      <PageContainer>
        <div className="mt-8 flex flex-col gap-4">
          <Notice icon={<Moon size={14} />} title="Room dormant">
            Dormant rooms stay in history. Waking {room.name} starts a fresh
            local session.
          </Notice>
          <div>
            <Button
              variant="primary"
              icon={<Sun size={15} />}
              onClick={() => wakeRoom(room.id)}
            >
              Wake room
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  const inCinema = room.status === "live" || room.status === "reconnecting";

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {inCinema ? (
          <CinemaRoom
            room={room}
            chatOpen={chatOpen}
            onToggleChat={() => setChatOpen((open) => !open)}
            onOpenVoice={() => setVoiceOpen(true)}
          />
        ) : (
          <WaitingRoom
            room={room}
            chatOpen={chatOpen}
            onOpenChat={() => setChatOpen(true)}
            onOpenVoice={() => setVoiceOpen(true)}
          />
        )}
      </div>

      <ChatDrawer
        room={room}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      <AnimatePresence>
        {voiceOpen ? (
          <VoicePanel
            key="voice"
            room={room}
            onClose={() => setVoiceOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
