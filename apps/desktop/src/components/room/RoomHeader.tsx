import { useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Copy,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  MessageSquare,
  Mic,
  Pencil,
  Trash2,
} from "lucide-react";

import type { RoomSummary } from "../../lib/rooms/types";
import { useAppStore } from "../../stores/app-store";
import { Button } from "../ui/Button";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { Popover } from "../ui/Popover";
import { InviteLink } from "./InviteLink";
import { RoomStatus } from "./RoomStatus";

export function RoomHeader({
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
  const { navigate, openDialog, archiveRoom, endRoom, copyInvitation, deleteRoom } =
    useAppStore();
  const inviteRef = useRef<HTMLButtonElement>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const backTarget =
    room.status === "dormant" || room.archived ? "history" : "active";

  const menuItems: ContextMenuItem[] = [
    {
      label: "Rename room",
      icon: <Pencil size={14} />,
      onSelect: () => openDialog({ kind: "rename-room", roomId: room.id }),
    },
    {
      label: room.isPasswordProtected ? "Change password" : "Set password",
      icon: <KeyRound size={14} />,
      onSelect: () => openDialog({ kind: "room-password", roomId: room.id }),
    },
    {
      label: "Copy invitation",
      icon: <Copy size={14} />,
      onSelect: () => void copyInvitation(room),
    },
    {
      label: "Archive room",
      icon: <Archive size={14} />,
      separatorBefore: true,
      onSelect: () => archiveRoom(room.id),
    },
  ];

  if (room.status !== "dormant" && !room.archived) {
    menuItems.push({
      label: "End room",
      icon: <LogOut size={14} />,
      onSelect: () => endRoom(room.id),
    });
  }

  menuItems.push({
    label: "Delete room",
    icon: <Trash2 size={14} />,
    separatorBefore: true,
    onSelect: () => {
      deleteRoom(room.id);
      navigate({ kind: "history" });
    },
  });

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={() => navigate({ kind: backTarget })}
          aria-label={backTarget === "active" ? "Back to Active rooms" : "Back to Room history"}
          title={backTarget === "active" ? "Back to Active rooms" : "Back to Room history"}
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-transparent text-ink-secondary transition-colors duration-100 hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[22px] font-[550] leading-7 tracking-[-0.015em] text-ink">
              {room.name}
            </h1>
            {room.isPasswordProtected ? (
              <Lock
                size={12}
                className="shrink-0 text-ink-secondary"
                aria-label="Password protected"
              />
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <RoomStatus room={room} size="sm" />
            <span aria-hidden className="h-3 w-px bg-line" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
              {room.invitationCode}
            </span>
            <span aria-hidden className="h-3 w-px bg-line" />
            <span className="text-[11px] text-ink-secondary">
              Demo room · local only
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant={chatOpen ? "secondary" : "ghost"}
          icon={<MessageSquare size={14} />}
          onClick={onOpenChat}
          aria-expanded={chatOpen}
        >
          Chat
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Mic size={14} />}
          onClick={onOpenVoice}
        >
          Voice
        </Button>

        <div className="relative">
          <Button
            ref={inviteRef}
            size="sm"
            variant="secondary"
            icon={<Link2 size={14} />}
            onClick={() => setInviteOpen((open) => !open)}
            aria-expanded={inviteOpen}
            aria-haspopup="dialog"
          >
            Invite
          </Button>
          <Popover
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            anchorRef={inviteRef}
            label="Room invitation"
            className="w-[340px]"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-secondary">
              Invitation
            </p>
            <h2 className="mt-1 text-[14px] font-medium text-ink">
              Invite the other participant
            </h2>
            <p className="mt-1 text-[11px] leading-4 text-ink-secondary">
              One room holds exactly two people. This code resolves against
              local demo data in this window.
            </p>
            <div className="mt-3">
              <InviteLink room={room} />
            </div>
            {room.isPasswordProtected ? (
              <p className="mt-3 border-t border-line-subtle pt-2.5 text-[11px] leading-4 text-ink-secondary">
                The room also requires its password. An invitation never
                bypasses protection.
              </p>
            ) : null}
          </Popover>
        </div>

        <ContextMenu
          label={`Room actions for ${room.name}`}
          items={menuItems}
        />
      </div>
    </header>
  );
}
