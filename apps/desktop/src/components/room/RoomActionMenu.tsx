import {
  Archive,
  ArchiveRestore,
  Copy,
  KeyRound,
  LockOpen,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";

import type { RoomSummary } from "../../lib/rooms/types";
import { useAppStore } from "../../stores/app-store";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";

export function RoomActionMenu({ room }: { room: RoomSummary }) {
  const {
    openRoom,
    openDialog,
    archiveRoom,
    unarchiveRoom,
    setRoomPassword,
    copyInvitation,
  } = useAppStore();

  const items: ContextMenuItem[] = [];

  if (room.archived) {
    items.push({
      label: "Restore to history",
      icon: <ArchiveRestore size={14} />,
      onSelect: () => unarchiveRoom(room.id),
    });
  } else {
    items.push({
      label: room.status === "dormant" ? "Wake room" : "Open room",
      icon: <Play size={14} />,
      onSelect: () => openRoom(room.id),
    });
  }

  items.push({
    label: "Copy invitation",
    icon: <Copy size={14} />,
    onSelect: () => void copyInvitation(room),
  });

  items.push({
    label: "Rename room",
    icon: <Pencil size={14} />,
    onSelect: () => openDialog({ kind: "rename-room", roomId: room.id }),
  });

  if (!room.archived) {
    items.push({
      label: room.isPasswordProtected ? "Change password" : "Set password",
      icon: <KeyRound size={14} />,
      onSelect: () => openDialog({ kind: "room-password", roomId: room.id }),
    });

    if (room.isPasswordProtected) {
      items.push({
        label: "Remove password protection",
        icon: <LockOpen size={14} />,
        onSelect: () => setRoomPassword(room.id, null),
      });
    }

    items.push({
      label: "Archive room",
      icon: <Archive size={14} />,
      separatorBefore: true,
      onSelect: () => archiveRoom(room.id),
    });
  }

  items.push({
    label: "Delete room",
    icon: <Trash2 size={14} />,
    separatorBefore: true,
    onSelect: () => openDialog({ kind: "delete-room", roomId: room.id }),
  });

  return (
    <ContextMenu
      label={`Room actions for ${room.name}`}
      items={items}
      triggerLabel={`Room actions for ${room.name}`}
    />
  );
}
