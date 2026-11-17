import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";

import { useAppStore } from "../../stores/app-store";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field } from "../../components/ui/Field";
import { PasswordInput } from "../../components/ui/PasswordInput";

const PASSWORD_MIN = 12;

export function RoomPasswordDialog({ roomId }: { roomId: string }) {
  const { rooms, closeDialog, setRoomPassword } = useAppStore();
  const room = rooms.find((candidate) => candidate.id === roomId);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!room) return null;

  const passwordInvalid =
    password.length < PASSWORD_MIN || password.length > 128;
  const confirmInvalid = password !== confirm;
  const passwordError =
    submitted && passwordInvalid
      ? `Use at least ${PASSWORD_MIN} characters.`
      : undefined;
  const confirmError =
    submitted && confirmInvalid ? "Passwords do not match." : undefined;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (passwordInvalid || confirmInvalid) return;
    setRoomPassword(room.id, password);
    closeDialog();
  };

  return (
    <Dialog
      title={room.isPasswordProtected ? "Change room password" : "Set room password"}
      description="A new password replaces the old one. Existing passwords cannot be viewed or recovered."
      onClose={closeDialog}
      footer={
        <>
          <Button variant="ghost" onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="room-password-form"
            variant="primary"
            icon={<KeyRound size={14} />}
          >
            Save password
          </Button>
        </>
      }
    >
      <form
        id="room-password-form"
        onSubmit={submit}
        className="flex flex-col gap-4"
      >
        <Field
          label="New room password"
          htmlFor="room-password-new"
          error={passwordError}
          hint={`At least ${PASSWORD_MIN} characters. In-memory demo only.`}
        >
          <PasswordInput
            id="room-password-new"
            data-autofocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={128}
            autoComplete="new-password"
          />
        </Field>
        <Field
          label="Confirm new password"
          htmlFor="room-password-confirm"
          error={confirmError}
        >
          <PasswordInput
            id="room-password-confirm"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            maxLength={128}
            autoComplete="new-password"
          />
        </Field>
        <p className="text-[11px] leading-4 text-ink-secondary">
          The prototype never writes this value to disk. The future backend
          stores only an Argon2id hash.
        </p>
      </form>
    </Dialog>
  );
}
