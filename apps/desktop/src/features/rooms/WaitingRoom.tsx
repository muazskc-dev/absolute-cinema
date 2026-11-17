import {
  ArrowRight,
  KeyRound,
  Loader2,
  LogOut,
  MessageSquare,
  Sparkles,
  UserPlus,
} from "lucide-react";

import {
  formatDateTime,
  formatRelativeTime,
  pluralize,
} from "../../lib/format";
import type { RoomSummary } from "../../lib/rooms/types";
import { useAppStore } from "../../stores/app-store";
import { RoomHeader } from "../../components/room/RoomHeader";
import { InviteLink } from "../../components/room/InviteLink";
import { ParticipantIndicator } from "../../components/room/ParticipantIndicator";
import { RoomStatus } from "../../components/room/RoomStatus";
import { Button } from "../../components/ui/Button";
import { DemoBadge } from "../../components/ui/DemoBadge";
import { Notice } from "../../components/ui/Notice";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-subtle py-2 last:border-b-0">
      <span className="text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
        {label}
      </span>
      <span className="min-w-0 text-right text-[11px] leading-4 text-ink">
        {children}
      </span>
    </div>
  );
}

const STEPS = [
  {
    title: "Send the invitation",
    body: "Copy the demo link and give it to the other participant.",
  },
  {
    title: "They join",
    body: "A second participant wakes the shared session.",
  },
  {
    title: "Cinema opens",
    body: "Chat and the local player deck become available.",
  },
];

export function WaitingRoom({
  room,
  chatOpen,
  onOpenChat,
  onOpenVoice,
}: {
  room: RoomSummary;
  chatOpen: boolean;
  onOpenChat: () => void;
  onOpenVoice: () => void;
}) {
  const { simulatePartnerJoin, endRoom, chatByRoom } = useAppStore();
  const waking = room.status === "waking";
  const messageCount = chatByRoom[room.id]?.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-6">
      <RoomHeader
        room={room}
        chatOpen={chatOpen}
        onOpenChat={onOpenChat}
        onOpenVoice={onOpenVoice}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 min-[1180px]:grid-cols-[1.618fr_1fr]">
        <div className="min-w-0">
          <section className="overflow-hidden rounded-xl border border-line bg-surface-1">
            <div className="border-b border-line-subtle px-7 py-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <RoomStatus room={room} />
                <DemoBadge label="Prototype" />
              </div>

              <div className="mt-5 flex items-start gap-4">
                <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-full border border-line text-ink-secondary">
                  {waking ? (
                    <Loader2
                      size={18}
                      className="animate-spin motion-reduce:animate-none"
                      aria-hidden
                    />
                  ) : (
                    <UserPlus size={18} aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="text-[22px] font-[550] leading-7 tracking-[-0.015em] text-ink">
                    {waking
                      ? "Waking the room runtime"
                      : "Waiting for the other participant"}
                  </h2>
                  <p className="mt-2 max-w-[52ch] text-[13px] leading-6 text-ink-secondary">
                    {waking
                      ? "The local room lifecycle is moving from dormant to waiting. This transition is simulated in the renderer."
                      : "The room exists and its invitation is ready. A second participant is required before the cinema opens."}
                  </p>
                </div>
              </div>

              {waking ? (
                <div className="mt-6 rounded-md border border-line-subtle bg-canvas px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-ink-secondary">
                      Lifecycle
                    </span>
                    <span className="font-mono text-[10px] text-ink-secondary">
                      DORMANT → WAKING → WAITING
                    </span>
                  </div>
                  <div className="mt-3 h-px w-full overflow-hidden bg-line">
                    <div className="ac-skeleton h-px w-1/3 bg-ink" />
                  </div>
                  <p className="mt-2.5 text-[11px] leading-4 text-ink-secondary">
                    No server request is sent. The transition resolves locally.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-6">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-ink-secondary">
                      Invitation link
                    </p>
                    <InviteLink room={room} />
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line-subtle pt-5">
                    <Button
                      variant="primary"
                      icon={<UserPlus size={15} />}
                      onClick={() => simulatePartnerJoin(room.id)}
                    >
                      Simulate partner joining
                    </Button>
                    <Button
                      variant="secondary"
                      icon={<MessageSquare size={15} />}
                      onClick={onOpenChat}
                    >
                      Open chat
                    </Button>
                  </div>

                  <div className="mt-4">
                    <Notice icon={<Sparkles size={14} />} title="Local prototype">
                      &quot;Simulate partner joining&quot; is a renderer-only
                      transition. No second device connects and no server
                      presence exists in Sprint 1.
                    </Notice>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 divide-y divide-line-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {STEPS.map((step, index) => (
                <div key={step.title} className="px-5 py-4">
                  <span className="font-mono text-[10px] text-ink-secondary">
                    0{index + 1}
                  </span>
                  <p className="mt-1 text-[12px] font-medium text-ink">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-ink-secondary">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <p className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-ink-secondary">
            <ArrowRight size={12} className="mt-0.5 shrink-0" aria-hidden />
            Playback synchronization is not active in Sprint 1. The cinema
            opens with a local player deck and honest &quot;local only&quot;
            labels.
          </p>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-line-subtle bg-surface-1 p-4">
            <h2 className="text-[12px] font-medium text-ink">Room details</h2>
            <div className="mt-2">
              <DetailRow label="Status">
                <RoomStatus room={room} size="sm" />
              </DetailRow>
              <DetailRow label="Participants">
                <ParticipantIndicator count={room.participantCount} size="sm" />
              </DetailRow>
              <DetailRow label="Access">
                <span className="inline-flex items-center gap-1.5">
                  {room.isPasswordProtected ? (
                    <>
                      <KeyRound size={11} aria-hidden /> Password protected
                    </>
                  ) : (
                    "Invitation only"
                  )}
                </span>
              </DetailRow>
              <DetailRow label="Invitation">
                <span className="font-mono">{room.invitationCode}</span>
              </DetailRow>
              <DetailRow label="Created">
                {formatDateTime(room.createdAt)}
              </DetailRow>
              <DetailRow label="Last active">
                {formatRelativeTime(room.lastActiveAt)}
              </DetailRow>
              <DetailRow label="Messages">
                {pluralize(messageCount, "message")}
              </DetailRow>
            </div>
          </section>

          <section className="rounded-xl border border-line-subtle bg-surface-1 p-4">
            <h2 className="text-[12px] font-medium text-ink">
              Local lifecycle
            </h2>
            <p className="mt-1 text-[11px] leading-4 text-ink-secondary">
              These controls exist for interface review. They do not contact a
              server.
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {!waking ? (
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  icon={<UserPlus size={14} />}
                  onClick={() => simulatePartnerJoin(room.id)}
                >
                  Partner joins → Live
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                fullWidth
                icon={<LogOut size={14} />}
                onClick={() => endRoom(room.id)}
              >
                End room → Dormant
              </Button>
            </div>
            <p className="mt-3 border-t border-line-subtle pt-2.5 text-[11px] leading-4 text-ink-secondary">
              Ending returns the room to Room history. It is not deleted.
            </p>
          </section>

          <Notice>
            Passwords are checked in memory for this prototype. The future
            server verifies an Argon2id hash and rate-limits attempts.
          </Notice>
        </aside>
      </div>
    </div>
  );
}
