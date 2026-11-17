import { Copy, Link2 } from "lucide-react";

import { invitationLink } from "../../lib/rooms/invite";
import type { RoomSummary } from "../../lib/rooms/types";
import { useAppStore } from "../../stores/app-store";
import { Button } from "../ui/Button";

export function InviteLink({ room }: { room: RoomSummary }) {
  const { copyInvitation } = useAppStore();
  const link = invitationLink(room.invitationCode);

  return (
    <div>
      <div className="flex items-center gap-2 rounded-md border border-line bg-surface-1 px-3 py-2">
        <Link2 size={14} className="shrink-0 text-ink-muted" aria-hidden />
        <code
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-secondary"
          title={link}
        >
          {link}
        </code>
        <Button
          size="sm"
          variant="secondary"
          icon={<Copy size={13} />}
          onClick={() => void copyInvitation(room)}
        >
          Copy
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-ink-secondary">
        Demo invitation. It is not a real server token yet.
      </p>
    </div>
  );
}
