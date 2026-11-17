import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Lock,
  LogIn,
  ClipboardPaste,
  Link2,
} from "lucide-react";

import { useAppStore } from "../../stores/app-store";
import { parseInvitationInput } from "../../lib/rooms/invite";
import type { RoomSummary } from "../../lib/rooms/types";
import { formatRelativeTime } from "../../lib/format";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { Notice } from "../../components/ui/Notice";
import { ParticipantIndicator } from "../../components/room/ParticipantIndicator";
import { RoomStatus } from "../../components/room/RoomStatus";

type JoinStep = "input" | "resolving" | "password" | "preview";

const DEMO_CODES = ["AC-WAIT", "AC-7F2K", "AC-FULL"] as const;

export function JoinRoomDialog() {
  const { closeDialog, findRoomByInvitation, joinRoom } = useAppStore();
  const [value, setValue] = useState("");
  const [step, setStep] = useState<JoinStep>("input");
  const [code, setCode] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const room: RoomSummary | undefined = code
    ? findRoomByInvitation(code)
    : undefined;
  const full = room
    ? room.status === "live" || room.participantCount >= 2
    : false;

  const resolve = () => {
    const parsed = parseInvitationInput(value);
    if (!parsed) {
      setInputError("Enter an invitation code or link.");
      return;
    }

    setInputError(null);
    setFlowError(null);
    setPasswordError(null);
    setCode(parsed);
    setStep("resolving");

    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const found = findRoomByInvitation(parsed);
      if (!found) {
        setStep("input");
        setInputError("This room is currently unavailable.");
        return;
      }
      if (found.archived) {
        setStep("input");
        setInputError("This room is archived. Restore it from Room history first.");
        return;
      }
      if (found.isPasswordProtected) {
        setPassword("");
        setStep("password");
        return;
      }
      setStep("preview");
    }, 300);
  };

  const attemptJoin = (candidatePassword?: string) => {
    if (!room) {
      setStep("input");
      setInputError("This room is currently unavailable.");
      return;
    }

    const outcome = joinRoom(room.id, candidatePassword);
    if (outcome.ok) return;

    if (outcome.reason === "password") {
      setPasswordError("Unable to join. Check the invitation and password.");
      return;
    }
    if (outcome.reason === "full") {
      setFlowError("This room already has two participants.");
      setStep("preview");
      return;
    }
    if (outcome.reason === "archived") {
      setStep("input");
      setInputError("This room is archived. Restore it from Room history first.");
      return;
    }
    setStep("input");
    setInputError("This room is currently unavailable.");
  };

  const submitCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resolve();
  };

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      setPasswordError("Enter the room password.");
      return;
    }
    attemptJoin(password);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setInputError("The clipboard is empty.");
        return;
      }
      setValue(text.trim());
      setInputError(null);
    } catch {
      setInputError("Clipboard access was denied. Use Ctrl+V instead.");
    }
  };

  const backToInput = () => {
    setStep("input");
    setPassword("");
    setPasswordError(null);
    setFlowError(null);
  };

  const description =
    step === "password"
      ? `Enter the password for ${room?.name ?? "this room"}.`
      : step === "preview"
        ? "Review the room before joining."
        : step === "resolving"
          ? "Resolving the invitation against local demo data."
          : "Enter an invitation code or link from the other participant.";

  const footer =
    step === "input" ? (
      <>
        <Button variant="ghost" onClick={closeDialog}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="join-code-form"
          variant="primary"
          icon={<LogIn size={15} />}
        >
          Continue
        </Button>
      </>
    ) : step === "resolving" ? (
      <Button variant="ghost" onClick={closeDialog}>
        Cancel
      </Button>
    ) : step === "password" ? (
      <>
        <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={backToInput}>
          Back
        </Button>
        <Button
          type="submit"
          form="join-password-form"
          variant="primary"
          icon={<LogIn size={15} />}
        >
          Join room
        </Button>
      </>
    ) : (
      <>
        <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={backToInput}>
          Back
        </Button>
        {full || flowError ? null : (
          <Button
            variant="primary"
            icon={<LogIn size={15} />}
            onClick={() => attemptJoin()}
          >
            Join room
          </Button>
        )}
      </>
    );

  return (
    <Dialog
      title="Join a room"
      description={description}
      onClose={closeDialog}
      footer={footer}
    >
      {step === "input" ? (
        <form id="join-code-form" onSubmit={submitCode} className="flex flex-col gap-4">
          <Field
            label="Invitation code or link"
            htmlFor="join-code"
            error={inputError ?? undefined}
            hint="Paste an invitation link or enter a code such as AC-WAIT."
          >
            <Input
              id="join-code"
              data-autofocus
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setInputError(null);
              }}
              placeholder="AC-XXXX or absolute-cinema://join/…"
              leading={<Link2 size={14} />}
              autoComplete="off"
              spellCheck={false}
              trailing={
                <button
                  type="button"
                  onClick={() => void pasteFromClipboard()}
                  title="Paste from clipboard"
                  aria-label="Paste from clipboard"
                  className="grid size-7 place-items-center rounded text-ink-muted transition-colors duration-100 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <ClipboardPaste size={14} />
                </button>
              }
            />
          </Field>

          <div className="rounded-md border border-line-subtle bg-surface-1 p-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted">
              Demo data
            </p>
            <p className="mt-1 text-[11px] leading-4 text-ink-secondary">
              These codes resolve against local rooms in this window. No server
              request is sent.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DEMO_CODES.map((demo) => (
                <button
                  key={demo}
                  type="button"
                  onClick={() => {
                    setValue(demo);
                    setInputError(null);
                  }}
                  className="rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[10px] text-ink-secondary transition-colors duration-100 hover:border-[#3a3a3a] hover:text-ink"
                >
                  {demo}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-4 text-ink-secondary">
              AC-7F2K password:{" "}
              <span className="font-mono text-ink">cinema-night</span>. AC-FULL is
              already 2/2.
            </p>
          </div>

          <p className="text-[11px] leading-4 text-ink-secondary">
            A valid invitation never bypasses password protection in the future
            backend.
          </p>
        </form>
      ) : null}

      {step === "resolving" ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Loader2 size={20} className="animate-spin text-ink-secondary" aria-hidden />
          <p className="mt-4 text-[13px] text-ink">Checking local demo data…</p>
          <p className="mt-1 text-[11px] text-ink-secondary">
            This is a local prototype delay, not a network request.
          </p>
        </div>
      ) : null}

      {step === "password" && room ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-md border border-line-subtle bg-surface-1 px-3 py-2.5">
            <Lock size={16} className="shrink-0 text-ink-secondary" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-ink">
                {room.name}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-secondary">
                Password protected · {room.participantCount} / 2 participants
              </p>
            </div>
          </div>

          <form id="join-password-form" onSubmit={submitPassword}>
            <Field
              label="Room password"
              htmlFor="join-password"
              error={passwordError ?? undefined}
              hint="Demo password for AC-7F2K: cinema-night"
            >
              <PasswordInput
                id="join-password"
                data-autofocus
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordError(null);
                }}
                autoComplete="current-password"
              />
            </Field>
          </form>

          {flowError ? (
            <Notice icon={<AlertCircle size={14} />}>{flowError}</Notice>
          ) : null}

          <p className="text-[11px] leading-4 text-ink-secondary">
            Sprint 1 checks the password in this window only. The future server
            verifies an Argon2id hash over TLS and rate-limits attempts.
          </p>
        </div>
      ) : null}

      {step === "preview" && room ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-line bg-surface-1 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                  Room found
                </p>
                <h3 className="mt-1 truncate text-[14px] font-[550] text-ink">
                  {room.name}
                </h3>
                <p className="mt-1 text-[11px] text-ink-secondary">
                  {room.partnerDisplayName
                    ? `With ${room.partnerDisplayName}`
                    : "No partner yet"}{" "}
                  · {formatRelativeTime(room.lastActiveAt)}
                </p>
              </div>
              <RoomStatus room={room} size="sm" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line-subtle pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  Participants
                </p>
                <ParticipantIndicator
                  count={room.participantCount}
                  size="sm"
                  className="mt-1.5"
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  Access
                </p>
                <p className="mt-1.5 text-[11px] text-ink-secondary">
                  {room.isPasswordProtected
                    ? "Password protected"
                    : "Invitation only"}
                </p>
              </div>
            </div>
          </div>

          {full || flowError ? (
            <Notice icon={<AlertCircle size={14} />} title="Cannot join">
              {flowError ?? "This room already has two participants."}
            </Notice>
          ) : (
            <p className="text-[11px] leading-4 text-ink-secondary">
              Joining wakes the room runtime. Shared playback synchronization
              arrives in a later sprint.
            </p>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
