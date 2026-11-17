import { useState, type FormEvent } from "react";

import { useAppStore } from "../../stores/app-store";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";

export function RenameRoomDialog({ roomId }: { roomId: string }) {
  const { rooms, closeDialog, renameRoom } = useAppStore();
  const room = rooms.find((candidate) => candidate.id === roomId);
  const [name, setName] = useState(room?.name ?? "");
  const [submitted, setSubmitted] = useState(false);

  if (!room) return null;

  const trimmed = name.trim();
  const invalid = trimmed.length < 2 || trimmed.length > 48;
  const error =
    submitted && invalid
      ? "Enter a room name between 2 and 48 characters."
      : undefined;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (invalid) return;
    renameRoom(room.id, trimmed);
    closeDialog();
  };

  return (
    <Dialog
      title="Rename room"
      description="The new name is visible in your local history only."
      onClose={closeDialog}
      footer={
        <>
          <Button variant="ghost" onClick={closeDialog}>
            Cancel
          </Button>
          <Button type="submit" form="rename-room-form" variant="primary">
            Save name
          </Button>
        </>
      }
    >
      <form id="rename-room-form" onSubmit={submit}>
        <Field
          label="Room name"
          htmlFor="rename-room-name"
          error={error}
          hint="2–48 characters."
        >
          <Input
            id="rename-room-name"
            data-autofocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            maxLength={48}
            autoComplete="off"
          />
        </Field>
      </form>
    </Dialog>
  );
}
