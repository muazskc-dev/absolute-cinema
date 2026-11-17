import { AnimatePresence } from "motion/react";

import { useAppStore } from "../../stores/app-store";
import { CreateRoomDialog } from "../../features/rooms/CreateRoomDialog";
import { JoinRoomDialog } from "../../features/rooms/JoinRoomDialog";
import { RenameRoomDialog } from "../../features/rooms/RenameRoomDialog";
import { RoomPasswordDialog } from "../../features/rooms/RoomPasswordDialog";
import { DeleteRoomDialog } from "../../features/rooms/DeleteRoomDialog";
import { ResetPreferencesDialog } from "../../features/rooms/ResetPreferencesDialog";

/**
 * Single owner of modal dialogs. Every dialog is portalled and focus-trapped;
 * AnimatePresence runs the exit transition when the store clears the dialog.
 */
export function DialogHost() {
  const { dialog } = useAppStore();

  return (
    <AnimatePresence>
      {dialog?.kind === "create-room" ? (
        <CreateRoomDialog key="create-room" />
      ) : null}
      {dialog?.kind === "join-room" ? <JoinRoomDialog key="join-room" /> : null}
      {dialog?.kind === "rename-room" ? (
        <RenameRoomDialog key={`rename-${dialog.roomId}`} roomId={dialog.roomId} />
      ) : null}
      {dialog?.kind === "room-password" ? (
        <RoomPasswordDialog
          key={`password-${dialog.roomId}`}
          roomId={dialog.roomId}
        />
      ) : null}
      {dialog?.kind === "delete-room" ? (
        <DeleteRoomDialog
          key={`delete-${dialog.roomId}`}
          roomId={dialog.roomId}
        />
      ) : null}
      {dialog?.kind === "reset-preferences" ? (
        <ResetPreferencesDialog key="reset-preferences" />
      ) : null}
    </AnimatePresence>
  );
}
