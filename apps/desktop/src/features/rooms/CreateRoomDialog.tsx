import { useState, type FormEvent } from "react";
import { Lock, Plus } from "lucide-react";

import { useAppStore } from "../../stores/app-store";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { Switch } from "../../components/ui/Switch";

const NAME_MIN = 2;
const NAME_MAX = 48;
const PASSWORD_MIN = 12;

export function CreateRoomDialog() {
  const { closeDialog, createRoom, preferences } = useAppStore();
  const [name, setName] = useState("");
  const [protectedRoom, setProtectedRoom] = useState(
    preferences.defaultPasswordProtection,
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const trimmedName = name.trim();
  const nameInvalid =
    trimmedName.length < NAME_MIN || trimmedName.length > NAME_MAX;
  const passwordInvalid =
    protectedRoom &&
    (password.length < PASSWORD_MIN || password.length > 128);
  const confirmInvalid = protectedRoom && password !== confirm;

  const nameError =
    submitted && nameInvalid
      ? `Enter a room name between ${NAME_MIN} and ${NAME_MAX} characters.`
      : undefined;
  const passwordError =
    submitted && passwordInvalid
      ? `Use at least ${PASSWORD_MIN} characters.`
      : undefined;
  const confirmError =
    submitted && confirmInvalid ? "Passwords do not match." : undefined;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (nameInvalid || passwordInvalid || confirmInvalid) return;
    createRoom({
      name: trimmedName,
      password: protectedRoom ? password : null,
    });
  };

  return (
    <Dialog
      title="Create a room"
      description="A private two-person space. It stays in your history after the session ends."
      onClose={closeDialog}
      footer={
        <>
          <Button variant="ghost" onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-room-form"
            variant="primary"
            icon={<Plus size={15} />}
          >
            Create room
          </Button>
        </>
      }
    >
      <form
        id="create-room-form"
        onSubmit={submit}
        className="flex flex-col gap-5"
      >
        <Field
          label="Room name"
          htmlFor="create-room-name"
          error={nameError}
          hint={`${NAME_MIN}–${NAME_MAX} characters. You can rename it later.`}
        >
          <Input
            id="create-room-name"
            data-autofocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Private Cinema"
            maxLength={NAME_MAX}
            autoComplete="off"
          />
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-md border border-line-subtle bg-surface-1 px-3 py-2.5">
          <div>
            <p className="text-[12px] font-medium text-ink">Participants</p>
            <p className="mt-0.5 text-[11px] text-ink-secondary">
              Two people per room.
            </p>
          </div>
          <span className="font-mono text-[11px] text-ink-secondary">2 max</span>
        </div>

        <div className="rounded-md border border-line-subtle bg-surface-1 px-3 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-ink">
                Password protection
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-ink-secondary">
                Only invited participants with the password can enter.
              </p>
            </div>
            <Switch
              id="create-room-protection"
              label="Password protection"
              checked={protectedRoom}
              onCheckedChange={(next) => {
                setProtectedRoom(next);
                if (!next) {
                  setPassword("");
                  setConfirm("");
                }
              }}
            />
          </div>

          {protectedRoom ? (
            <div className="mt-4 flex flex-col gap-4 border-t border-line-subtle pt-4">
              <Field
                label="Room password"
                htmlFor="create-room-password"
                error={passwordError}
                hint={`At least ${PASSWORD_MIN} characters. Kept in memory only.`}
              >
                <PasswordInput
                  id="create-room-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </Field>
              <Field
                label="Confirm password"
                htmlFor="create-room-confirm"
                error={confirmError}
              >
                <PasswordInput
                  id="create-room-confirm"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </Field>
            </div>
          ) : null}
        </div>

        <p className="flex items-start gap-2 text-[11px] leading-4 text-ink-secondary">
          <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Passwords are never stored on disk in this prototype. Server-side
            verification and recovery arrive with the backend sprint.
          </span>
        </p>
      </form>
    </Dialog>
  );
}
