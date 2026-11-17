import type { RoomSummary } from "../../lib/rooms/types";
import { StatusLabel } from "../ui/StatusLabel";

export function RoomStatus({
  room,
  size = "md",
  className,
}: {
  room: RoomSummary;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <StatusLabel
      status={room.archived ? "archived" : room.status}
      participantCount={room.participantCount}
      size={size}
      className={className}
    />
  );
}
