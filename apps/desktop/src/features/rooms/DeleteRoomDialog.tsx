import { Trash2 } from "lucide-react";

import { useAppStore } from "../../stores/app-store";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Notice } from "../../components/ui/Notice";
import { RoomStatus } from "../../components/room/RoomStatus";

export function DeleteRoomDialog({ roomId }: { roomId: string }) {
  const { rooms, closeDialog, deleteRoom } = useAppStore();
  const room = rooms.find((candidate) => candidate.id === roomId);

  if (!room) return null;

  return (
    <Dialog
      title="Delete room"
      description="This cannot be undone in the local prototype."
      onClose={closeDialog}
      footer={
        <>
          <Button variant="ghost" data-autofocus onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<Trash2 size={14} />}
            onClick={() => deleteRoom(room.id)}
          >
            Delete room
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-line bg-surface-1 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Room
              </p>
              <p className="mt-1 truncate text-[14px] font-medium text-ink">
                {room.name}
              </p>
            </div>
            <RoomStatus room={room} size="sm" />
          </div>
        </div>

        <p className="text-[12px] leading-5 text-ink-secondary">
          Deleting removes the room from local history and discards its local
          chat messages. A future server will keep a soft-delete record and an
          explicit retention policy.
        </p>

        <Notice>
          Demo rooms are not stored on a server. This action only affects this
          window.
        </Notice>
      </div>
    </Dialog>
  );
}
