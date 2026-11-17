import { useEffect } from "react";
import {
  AlertTriangle,
  KeyRound,
  Link2,
  LogOut,
  MessageSquare,
  MonitorPlay,
  RefreshCw,
  Unplug,
  Users,
} from "lucide-react";

import { useMpvBridge } from "../../hooks/use-mpv-bridge";
import {
  basename,
  formatDateTime,
  formatRelativeTime,
  formatTime,
  pluralize,
  shortError,
} from "../../lib/format";
import type { RoomSummary } from "../../lib/rooms/types";
import { useAppStore } from "../../stores/app-store";
import { RoomHeader } from "../../components/room/RoomHeader";
import { ParticipantIndicator } from "../../components/room/ParticipantIndicator";
import { RoomStatus } from "../../components/room/RoomStatus";
import { Button } from "../../components/ui/Button";
import { DemoBadge } from "../../components/ui/DemoBadge";
import { Kbd } from "../../components/ui/Primitives";
import { Notice } from "../../components/ui/Notice";
import { PlayerControls } from "./PlayerControls";
import { PlayerSurface } from "./PlayerSurface";
import { SourceBar } from "./SourceBar";

const SHORTCUTS = [
  ["Space", "Play / pause"],
  ["← →", "5 seconds"],
  ["Shift ← →", "30 seconds"],
  ["↑ ↓", "Volume"],
  ["M", "Mute"],
  ["F", "Fullscreen"],
  ["C", "Chat"],
] as const;

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
      <span className="min-w-0 break-words text-right text-[11px] leading-4 text-ink">
        {children}
      </span>
    </div>
  );
}

export function CinemaRoom({
  room,
  chatOpen,
  onToggleChat,
  onOpenVoice,
}: {
  room: RoomSummary;
  chatOpen: boolean;
  onToggleChat: () => void;
  onOpenVoice: () => void;
}) {
  const bridge = useMpvBridge();
  const {
    dialog,
    chatByRoom,
    simulateDisconnect,
    simulateReconnect,
    endRoom,
  } = useAppStore();

  const {
    togglePause,
    seekBy,
    setVolume,
    toggleMute,
    toggleFullscreen,
    snapshot,
  } = bridge;
  const messageCount = chatByRoom[room.id]?.length ?? 0;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialog != null) return;
      if (isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      switch (event.key) {
        case " ":
        case "Spacebar":
          event.preventDefault();
          void togglePause();
          break;
        case "ArrowLeft":
          event.preventDefault();
          void seekBy(event.shiftKey ? -30 : -5);
          break;
        case "ArrowRight":
          event.preventDefault();
          void seekBy(event.shiftKey ? 30 : 5);
          break;
        case "ArrowUp":
          event.preventDefault();
          void setVolume(Math.min(100, snapshot.volume + 5));
          break;
        case "ArrowDown":
          event.preventDefault();
          void setVolume(Math.max(0, snapshot.volume - 5));
          break;
        case "m":
        case "M":
          event.preventDefault();
          void toggleMute();
          break;
        case "f":
        case "F":
          event.preventDefault();
          void toggleFullscreen();
          break;
        case "c":
        case "C":
          event.preventDefault();
          onToggleChat();
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    dialog,
    onToggleChat,
    seekBy,
    setVolume,
    snapshot.volume,
    toggleFullscreen,
    toggleMute,
    togglePause,
  ]);

  const error = bridge.error ?? snapshot.lastError;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-6">
      <RoomHeader
        room={room}
        chatOpen={chatOpen}
        onOpenChat={onToggleChat}
        onOpenVoice={onOpenVoice}
      />

      <div className="mt-5 grid grid-cols-1 gap-5 min-[1180px]:grid-cols-[1.618fr_1fr]">
        <div className="min-w-0">
          {room.status === "reconnecting" ? (
            <div className="mb-3">
              <Notice
                icon={<RefreshCw size={14} className="animate-spin [animation-duration:2.6s] motion-reduce:animate-none" />}
                title="Partner reconnecting"
              >
                The local prototype holds the session in a reconnection grace
                state. Playback on this machine is unaffected.
              </Notice>
            </div>
          ) : null}

          <PlayerSurface
            bridge={bridge}
            onOpenFile={() => void bridge.openFile()}
          />

          <div className="mt-2 overflow-hidden rounded-xl border border-line bg-surface-1">
            <PlayerControls bridge={bridge} />
          </div>

          <div className="mt-3">
            <SourceBar bridge={bridge} />
          </div>

          {error ? (
            <div className="mt-3 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Notice
                  icon={<AlertTriangle size={14} />}
                  title="Media engine error"
                >
                  {shortError(error, 360)}
                </Notice>
              </div>
              {bridge.error ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={bridge.clearError}
                  className="shrink-0"
                >
                  Dismiss
                </Button>
              ) : null}
            </div>
          ) : null}

          <section
            aria-label="Keyboard shortcuts"
            className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-subtle pt-3"
          >
            {SHORTCUTS.map(([key, label]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 text-[10px] text-ink-secondary"
              >
                <Kbd>{key}</Kbd>
                {label}
              </span>
            ))}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-line-subtle bg-surface-1 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[12px] font-medium text-ink">Session</h2>
                <p className="mt-1 text-[11px] leading-4 text-ink-secondary">
                  Two seats. One room.
                </p>
              </div>
              <DemoBadge label="Local" />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-line-subtle bg-canvas px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-[11px] text-ink">
                <Users size={13} aria-hidden />
                Participants
              </span>
              <ParticipantIndicator count={room.participantCount} size="sm" />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-line-subtle bg-canvas px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.1em] text-ink-secondary">
                  You
                </p>
                <p className="mt-0.5 text-[11px] text-ink">Connected</p>
              </div>
              <div className="rounded-md border border-line-subtle bg-canvas px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.1em] text-ink-secondary">
                  {room.partnerDisplayName ?? "Partner"}
                </p>
                <p className="mt-0.5 text-[11px] text-ink">
                  {room.status === "live" ? "Connected" : "Reconnecting"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              {room.status === "live" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  icon={<Unplug size={14} />}
                  onClick={() => simulateDisconnect(room.id)}
                >
                  Simulate partner disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  fullWidth
                  icon={<RefreshCw size={14} />}
                  onClick={() => simulateReconnect(room.id)}
                >
                  Simulate reconnect
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                fullWidth
                icon={<MessageSquare size={14} />}
                onClick={onToggleChat}
              >
                Chat · {pluralize(messageCount, "message")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                fullWidth
                icon={<LogOut size={14} />}
                onClick={() => endRoom(room.id)}
              >
                End room
              </Button>
            </div>

            <p className="mt-3 border-t border-line-subtle pt-2.5 text-[10px] leading-4 text-ink-secondary">
              Lifecycle buttons are local prototype transitions. No presence or
              sync server is connected.
            </p>
          </section>

          <section className="rounded-xl border border-line-subtle bg-surface-1 p-4">
            <div className="flex items-center gap-2">
              <MonitorPlay size={13} className="text-ink-secondary" aria-hidden />
              <h2 className="text-[12px] font-medium text-ink">Playback</h2>
            </div>
            <div className="mt-2">
              <DetailRow label="Source">
                <span
                  className="font-mono"
                  title={snapshot.path ?? undefined}
                >
                  {snapshot.path ? basename(snapshot.path) : "No source"}
                </span>
              </DetailRow>
              <DetailRow label="Engine">
                {snapshot.running ? "mpv running" : "mpv idle"}
              </DetailRow>
              <DetailRow label="State">
                {snapshot.paused ? "Paused" : "Playing"}
              </DetailRow>
              <DetailRow label="Position">
                <span className="font-mono">
                  {formatTime(snapshot.position)} / {formatTime(snapshot.duration)}
                </span>
              </DetailRow>
              {snapshot.video?.width && snapshot.video?.height ? (
                <DetailRow label="Resolution">
                  <span className="font-mono">
                    {snapshot.video.width}×{snapshot.video.height}
                  </span>
                </DetailRow>
              ) : null}
              {snapshot.hwdec ? (
                <DetailRow label="hwdec">
                  <span className="font-mono">{snapshot.hwdec}</span>
                </DetailRow>
              ) : null}
            </div>
            <p className="mt-2.5 border-t border-line-subtle pt-2.5 text-[10px] leading-4 text-ink-secondary">
              Playback is local to this machine. Server-authoritative
              synchronization is not implemented in Sprint 1.
            </p>

            <details className="mt-2 border-t border-line-subtle pt-2">
              <summary className="cursor-pointer select-none text-[10px] uppercase tracking-[0.12em] text-ink-secondary transition-colors duration-100 hover:text-ink">
                Details
              </summary>
              <div className="mt-1">
                <DetailRow label="PID">
                  <span className="font-mono">{snapshot.pid ?? "—"}</span>
                </DetailRow>
                <DetailRow label="Frame drops">
                  <span className="font-mono">
                    {snapshot.frameDrops ?? 0} /{" "}
                    {snapshot.decoderFrameDrops ?? 0}
                  </span>
                </DetailRow>
                <DetailRow label="Pixel format">
                  <span className="font-mono">
                    {snapshot.video?.pixelFormat ?? "—"}
                  </span>
                </DetailRow>
                <DetailRow label="HW pixel">
                  <span className="font-mono">
                    {snapshot.video?.hwPixelFormat ?? "—"}
                  </span>
                </DetailRow>
                <DetailRow label="Audio">
                  <span className="font-mono">
                    {snapshot.audio?.codec ?? "—"}
                    {snapshot.audio?.channels != null
                      ? ` · ${snapshot.audio.channels} ch`
                      : ""}
                  </span>
                </DetailRow>
              </div>
            </details>
          </section>

          <section className="rounded-xl border border-line-subtle bg-surface-1 p-4">
            <h2 className="text-[12px] font-medium text-ink">Room</h2>
            <div className="mt-2">
              <DetailRow label="Status">
                <RoomStatus room={room} size="sm" />
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
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <Link2 size={11} aria-hidden />
                  {room.invitationCode}
                </span>
              </DetailRow>
              <DetailRow label="Created">
                {formatDateTime(room.createdAt)}
              </DetailRow>
              <DetailRow label="Last active">
                {formatRelativeTime(room.lastActiveAt)}
              </DetailRow>
            </div>
          </section>

          <Notice>
            mpv renders in its own window. The room surface never embeds video
            in Sprint 1.
          </Notice>
        </aside>
      </div>
    </div>
  );
}
