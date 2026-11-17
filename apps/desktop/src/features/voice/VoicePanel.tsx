import { MicOff, ShieldCheck } from "lucide-react";

import type { RoomSummary } from "../../lib/rooms/types";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Notice } from "../../components/ui/Notice";

export function VoicePanel({
  room,
  onClose,
}: {
  room: RoomSummary;
  onClose: () => void;
}) {
  return (
    <Dialog
      title="Voice"
      description={`Prepared for ${room.name}. Voice is not connected yet.`}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" data-autofocus onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" icon={<MicOff size={14} />} disabled>
            Join voice
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-md border border-line bg-surface-1 px-3.5 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-ink-secondary">
            <MicOff size={15} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-ink">Voice not connected</p>
            <p className="mt-0.5 text-[11px] leading-4 text-ink-secondary">
              No microphone permission has been requested.
            </p>
          </div>
        </div>

        <p className="text-[12px] leading-5 text-ink-secondary">
          Voice is a later sprint: WebRTC peer connection, a coturn relay and
          device selection. This panel exists so the room layout and controls do
          not need to be redesigned when that work starts.
        </p>

        <ul className="flex flex-col gap-2 border-t border-line-subtle pt-3 text-[11px] leading-4 text-ink-secondary">
          <li>Two-person voice with push-to-talk.</li>
          <li>Explicit microphone permission before any capture.</li>
          <li>Relay fallback through coturn when direct peers fail.</li>
          <li>Mute, input level and device choice in Settings.</li>
        </ul>

        <Notice icon={<ShieldCheck size={14} />} title="Privacy">
          The prototype never opens the microphone. Joining voice stays disabled
          until the real service exists.
        </Notice>
      </div>
    </Dialog>
  );
}
