export type RoomLifecycleState =
  | "dormant"
  | "waking"
  | "waiting"
  | "live"
  | "reconnecting";

/**
 * A persistent room record plus its temporary local session fields.
 *
 * `demoPassword` exists only in memory for the Sprint 1 prototype. It is never
 * written to localStorage, never rendered, and must not be carried into the
 * backend design — the future server stores an Argon2id hash only.
 */
export interface RoomSummary {
  id: string;
  name: string;
  status: RoomLifecycleState;
  participantCount: number;
  maxParticipants: 2;
  isPasswordProtected: boolean;
  createdAt: string;
  lastActiveAt: string;
  partnerDisplayName?: string;
  lastMediaLabel?: string;
  invitationCode: string;
  archived: boolean;
  /** In-memory demo value only. Never persist or display. */
  demoPassword: string | null;
  isDemo: true;
}

export type SettingsSection =
  | "general"
  | "appearance"
  | "playback"
  | "audio"
  | "subtitles"
  | "privacy"
  | "rooms"
  | "advanced"
  | "about";

export type View =
  | { kind: "home" }
  | { kind: "active" }
  | { kind: "history" }
  | { kind: "settings"; section?: SettingsSection }
  | { kind: "lab" }
  | { kind: "room"; roomId: string };

export type DialogState =
  | null
  | { kind: "create-room" }
  | { kind: "join-room" }
  | { kind: "rename-room"; roomId: string }
  | { kind: "room-password"; roomId: string }
  | { kind: "delete-room"; roomId: string }
  | { kind: "reset-preferences" };

export interface Preferences {
  reducedMotion: boolean;
  defaultVolume: number;
  defaultSpeed: number;
  subtitleScale: number;
  defaultPasswordProtection: boolean;
  copyInvitationOnCreate: boolean;
  showArchivedByDefault: boolean;
  sidebarCollapsed: boolean;
}

export interface ChatMessage {
  id: string;
  author: "you" | "partner";
  body: string;
  at: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  kind: "info" | "error";
}

export type CreateRoomInput = {
  name: string;
  password: string | null;
};

export type JoinOutcome =
  | { ok: true }
  | {
      ok: false;
      reason: "password" | "full" | "unavailable" | "archived";
    };

export function isRoomActive(room: RoomSummary): boolean {
  return (
    room.status === "waking" ||
    room.status === "waiting" ||
    room.status === "live" ||
    room.status === "reconnecting"
  );
}

export function isRoomDormant(room: RoomSummary): boolean {
  return room.status === "dormant";
}
