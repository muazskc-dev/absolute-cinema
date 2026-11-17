import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { copyText } from "../lib/clipboard";
import { invitationLink } from "../lib/rooms/invite";
import { seedRooms } from "../lib/rooms/seed";
import {
  isRoomActive,
  type ChatMessage,
  type CreateRoomInput,
  type DialogState,
  type JoinOutcome,
  type Preferences,
  type RoomLifecycleState,
  type RoomSummary,
  type ToastMessage,
  type View,
} from "../lib/rooms/types";

export const PREFERENCES_KEY = "ac.preferences.v1";

export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const SUBTITLE_SCALES = [0.8, 1, 1.2, 1.4, 1.6] as const;

export const DEFAULT_PREFERENCES: Preferences = {
  reducedMotion: false,
  defaultVolume: 100,
  defaultSpeed: 1,
  subtitleScale: 1,
  defaultPasswordProtection: false,
  copyInvitationOnCreate: true,
  showArchivedByDefault: false,
  sidebarCollapsed: false,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
}

export function loadPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Record<keyof Preferences, unknown>>;
    const speed = asNumber(parsed.defaultSpeed, DEFAULT_PREFERENCES.defaultSpeed, 0.5, 2);
    return {
      reducedMotion: asBoolean(
        parsed.reducedMotion,
        DEFAULT_PREFERENCES.reducedMotion,
      ),
      defaultVolume: Math.round(
        asNumber(
          parsed.defaultVolume,
          DEFAULT_PREFERENCES.defaultVolume,
          0,
          100,
        ),
      ),
      defaultSpeed: SPEED_OPTIONS.includes(speed as (typeof SPEED_OPTIONS)[number])
        ? speed
        : DEFAULT_PREFERENCES.defaultSpeed,
      subtitleScale: asNumber(
        parsed.subtitleScale,
        DEFAULT_PREFERENCES.subtitleScale,
        0.8,
        1.6,
      ),
      defaultPasswordProtection: asBoolean(
        parsed.defaultPasswordProtection,
        DEFAULT_PREFERENCES.defaultPasswordProtection,
      ),
      copyInvitationOnCreate: asBoolean(
        parsed.copyInvitationOnCreate,
        DEFAULT_PREFERENCES.copyInvitationOnCreate,
      ),
      showArchivedByDefault: asBoolean(
        parsed.showArchivedByDefault,
        DEFAULT_PREFERENCES.showArchivedByDefault,
      ),
      sidebarCollapsed: asBoolean(
        parsed.sidebarCollapsed,
        DEFAULT_PREFERENCES.sidebarCollapsed,
      ),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function randomId(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${prefix}-${token}`;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeInvitationCode(existing: Set<string>): string {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const code = `AC-${Array.from(
      bytes,
      (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length],
    ).join("")}`;
    if (!existing.has(code)) return code;
  }
  return `AC-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

const STATUS_RANK: Record<RoomLifecycleState, number> = {
  live: 0,
  waiting: 1,
  reconnecting: 2,
  waking: 3,
  dormant: 4,
};

export interface AppStore {
  view: View;
  rooms: RoomSummary[];
  activeRooms: RoomSummary[];
  recentRooms: RoomSummary[];
  preferences: Preferences;
  dialog: DialogState;
  toasts: ToastMessage[];
  chatByRoom: Record<string, ChatMessage[]>;

  navigate: (view: View) => void;
  openDialog: (dialog: NonNullable<DialogState>) => void;
  closeDialog: () => void;

  openRoom: (roomId: string) => void;
  wakeRoom: (roomId: string) => void;
  createRoom: (input: CreateRoomInput) => RoomSummary;
  findRoomByInvitation: (code: string) => RoomSummary | undefined;
  joinRoom: (roomId: string, password?: string) => JoinOutcome;
  renameRoom: (roomId: string, name: string) => void;
  setRoomPassword: (roomId: string, password: string | null) => void;
  archiveRoom: (roomId: string) => void;
  unarchiveRoom: (roomId: string) => void;
  deleteRoom: (roomId: string) => void;

  simulatePartnerJoin: (roomId: string) => void;
  simulateDisconnect: (roomId: string) => void;
  simulateReconnect: (roomId: string) => void;
  endRoom: (roomId: string) => void;

  copyInvitation: (room: RoomSummary) => Promise<void>;

  sendChatMessage: (roomId: string, body: string) => void;
  clearChat: (roomId: string) => void;

  pushToast: (message: string, kind?: ToastMessage["kind"]) => void;
  dismissToast: (id: string) => void;

  updatePreferences: (patch: Partial<Preferences>) => void;
  resetPreferences: () => void;
}

const AppStoreContext = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ kind: "home" });
  const [rooms, setRooms] = useState<RoomSummary[]>(() => seedRooms());
  const [preferences, setPreferences] =
    useState<Preferences>(() => loadPreferences());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [chatByRoom, setChatByRoom] = useState<Record<string, ChatMessage[]>>(
    {},
  );

  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;

  const timers = useRef<Set<number>>(new Set());
  const schedule = useCallback((action: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      action();
    }, delay);
    timers.current.add(timer);
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current.clear();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(
      preferences.reducedMotion,
    );
    try {
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // A full or blocked storage area must not break the interface.
    }
  }, [preferences]);

  const navigate = useCallback((next: View) => {
    setDialog(null);
    setView(next);
  }, []);

  const openDialog = useCallback((next: NonNullable<DialogState>) => {
    setDialog(next);
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  const dismissToast = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, kind: ToastMessage["kind"] = "info") => {
      const toast: ToastMessage = { id: randomId("toast"), message, kind };
      setToasts((previous) => [...previous.slice(-2), toast]);
      schedule(() => {
        setToasts((previous) =>
          previous.filter((candidate) => candidate.id !== toast.id),
        );
      }, 4600);
    },
    [schedule],
  );

  const copyInvitation = useCallback(
    async (room: RoomSummary) => {
      const copied = await copyText(invitationLink(room.invitationCode));
      pushToast(
        copied
          ? "Demo invitation copied. It is not a real server token yet."
          : "Could not copy the invitation. Select the link and copy it manually.",
        copied ? "info" : "error",
      );
    },
    [pushToast],
  );

  const wakeRoom = useCallback(
    (roomId: string) => {
      const room = roomsRef.current.find((candidate) => candidate.id === roomId);
      if (!room) {
        pushToast("This room is no longer in local history.", "error");
        return;
      }
      if (room.archived) {
        pushToast("Unarchive this room before waking it.", "error");
        return;
      }
      if (room.status !== "dormant") {
        setView({ kind: "room", roomId });
        return;
      }

      setRooms((previous) =>
        previous.map((candidate) =>
          candidate.id === roomId
            ? {
                ...candidate,
                status: "waking",
                participantCount: 1,
                lastActiveAt: new Date().toISOString(),
              }
            : candidate,
        ),
      );
      setView({ kind: "room", roomId });

      schedule(() => {
        setRooms((previous) =>
          previous.map((candidate) =>
            candidate.id === roomId && candidate.status === "waking"
              ? {
                  ...candidate,
                  status: "waiting",
                  participantCount: 1,
                  lastActiveAt: new Date().toISOString(),
                }
              : candidate,
          ),
        );
      }, 900);
    },
    [pushToast, schedule],
  );

  const openRoom = useCallback(
    (roomId: string) => {
      const room = roomsRef.current.find((candidate) => candidate.id === roomId);
      if (!room) {
        pushToast("This room is no longer in local history.", "error");
        return;
      }
      if (room.status === "dormant") {
        wakeRoom(roomId);
        return;
      }
      setView({ kind: "room", roomId });
    },
    [pushToast, wakeRoom],
  );

  const createRoom = useCallback(
    ({ name, password }: CreateRoomInput) => {
      const existingCodes = new Set(
        roomsRef.current.map((room) => room.invitationCode),
      );
      const now = new Date().toISOString();
      const room: RoomSummary = {
        id: randomId("room"),
        name: name.trim() || "Untitled room",
        status: "waiting",
        participantCount: 1,
        maxParticipants: 2,
        isPasswordProtected: password != null && password.length > 0,
        createdAt: now,
        lastActiveAt: now,
        invitationCode: makeInvitationCode(existingCodes),
        archived: false,
        demoPassword:
          password != null && password.length > 0 ? password : null,
        isDemo: true,
        partnerDisplayName: undefined,
        lastMediaLabel: undefined,
      };

      setRooms((previous) => [room, ...previous]);
      setDialog(null);
      setView({ kind: "room", roomId: room.id });

      if (preferences.copyInvitationOnCreate) {
        void copyText(invitationLink(room.invitationCode)).then((copied) => {
          pushToast(
            copied
              ? "Room created. Demo invitation copied."
              : "Room created. Copy the invitation from the waiting room.",
            copied ? "info" : "error",
          );
        });
      } else {
        pushToast(
          "Room created. Invite the other participant from the waiting room.",
        );
      }

      return room;
    },
    [preferences.copyInvitationOnCreate, pushToast],
  );

  const findRoomByInvitation = useCallback((code: string) => {
    return roomsRef.current.find(
      (room) => room.invitationCode.toUpperCase() === code.toUpperCase(),
    );
  }, []);

  const joinRoom = useCallback(
    (roomId: string, password?: string): JoinOutcome => {
      const room = roomsRef.current.find((candidate) => candidate.id === roomId);
      if (!room) return { ok: false, reason: "unavailable" };
      if (room.archived) return { ok: false, reason: "archived" };
      if (room.status === "live" || room.participantCount >= 2) {
        return { ok: false, reason: "full" };
      }
      if (room.isPasswordProtected && room.demoPassword !== password) {
        return { ok: false, reason: "password" };
      }

      const now = new Date().toISOString();

      if (room.status === "dormant") {
        setRooms((previous) =>
          previous.map((candidate) =>
            candidate.id === roomId
              ? {
                  ...candidate,
                  status: "waking",
                  participantCount: 1,
                  lastActiveAt: now,
                }
              : candidate,
          ),
        );
        setDialog(null);
        setView({ kind: "room", roomId });
        schedule(() => {
          setRooms((previous) =>
            previous.map((candidate) =>
              candidate.id === roomId && candidate.status === "waking"
                ? {
                    ...candidate,
                    status: "waiting",
                    participantCount: 1,
                    lastActiveAt: new Date().toISOString(),
                  }
                : candidate,
            ),
          );
        }, 900);
        return { ok: true };
      }

      if (room.status === "waking") {
        setDialog(null);
        setView({ kind: "room", roomId });
        return { ok: true };
      }

      setRooms((previous) =>
        previous.map((candidate) =>
          candidate.id === roomId
            ? {
                ...candidate,
                status: "live",
                participantCount: 2,
                partnerDisplayName:
                  candidate.partnerDisplayName ?? "Partner",
                lastActiveAt: now,
              }
            : candidate,
        ),
      );
      setDialog(null);
      setView({ kind: "room", roomId });
      return { ok: true };
    },
    [schedule],
  );

  const renameRoom = useCallback(
    (roomId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setRooms((previous) =>
        previous.map((room) =>
          room.id === roomId ? { ...room, name: trimmed } : room,
        ),
      );
      pushToast("Room renamed.");
    },
    [pushToast],
  );

  const setRoomPassword = useCallback(
    (roomId: string, password: string | null) => {
      setRooms((previous) =>
        previous.map((room) =>
          room.id === roomId
            ? {
                ...room,
                isPasswordProtected: password != null && password.length > 0,
                demoPassword:
                  password != null && password.length > 0 ? password : null,
              }
            : room,
        ),
      );
      pushToast(
        password
          ? "Demo password updated. It is kept in memory only."
          : "Password protection removed.",
      );
    },
    [pushToast],
  );

  const archiveRoom = useCallback(
    (roomId: string) => {
      setRooms((previous) =>
        previous.map((room) =>
          room.id === roomId ? { ...room, archived: true } : room,
        ),
      );
      if (view.kind === "room" && view.roomId === roomId) {
        setView({ kind: "history" });
      }
      pushToast("Room archived. It stays recoverable in Room history.");
    },
    [pushToast, view],
  );

  const unarchiveRoom = useCallback(
    (roomId: string) => {
      setRooms((previous) =>
        previous.map((room) =>
          room.id === roomId ? { ...room, archived: false } : room,
        ),
      );
      pushToast("Room restored to Room history.");
    },
    [pushToast],
  );

  const deleteRoom = useCallback(
    (roomId: string) => {
      setRooms((previous) => previous.filter((room) => room.id !== roomId));
      setChatByRoom((previous) => {
        if (!(roomId in previous)) return previous;
        const next = { ...previous };
        delete next[roomId];
        return next;
      });
      setDialog(null);
      setView({ kind: "history" });
      pushToast("Room deleted from local history.");
    },
    [pushToast],
  );

  const simulatePartnerJoin = useCallback(
    (roomId: string) => {
      setRooms((previous) =>
        previous.map((room) =>
          room.id === roomId && room.status === "waiting"
            ? {
                ...room,
                status: "live",
                participantCount: 2,
                partnerDisplayName: room.partnerDisplayName ?? "Partner",
                lastActiveAt: new Date().toISOString(),
              }
            : room,
        ),
      );
      pushToast("Partner joined. This is a local demo transition.");
    },
    [pushToast],
  );

  const simulateDisconnect = useCallback(
    (roomId: string) => {
      setRooms((previous) =>
        previous.map((room) =>
          room.id === roomId && room.status === "live"
            ? {
                ...room,
                status: "reconnecting",
                participantCount: 1,
                lastActiveAt: new Date().toISOString(),
              }
            : room,
        ),
      );
      pushToast("Partner connection lost. Reconnection grace is a demo state.");
    },
    [pushToast],
  );

  const simulateReconnect = useCallback(
    (roomId: string) => {
      setRooms((previous) =>
        previous.map((room) =>
          room.id === roomId && room.status === "reconnecting"
            ? {
                ...room,
                status: "live",
                participantCount: 2,
                partnerDisplayName: room.partnerDisplayName ?? "Partner",
                lastActiveAt: new Date().toISOString(),
              }
            : room,
        ),
      );
      pushToast("Partner reconnected. Local demo state.");
    },
    [pushToast],
  );

  const endRoom = useCallback(
    (roomId: string) => {
      setRooms((previous) =>
        previous.map((room) =>
          room.id === roomId
            ? {
                ...room,
                status: "dormant",
                participantCount: 0,
                lastActiveAt: new Date().toISOString(),
              }
            : room,
        ),
      );
      setView({ kind: "history" });
      pushToast("Room ended. It stays in Room history as dormant.");
    },
    [pushToast],
  );

  const sendChatMessage = useCallback((roomId: string, body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const message: ChatMessage = {
      id: randomId("message"),
      author: "you",
      body: trimmed.slice(0, 2000),
      at: new Date().toISOString(),
    };
    setChatByRoom((previous) => ({
      ...previous,
      [roomId]: [...(previous[roomId] ?? []), message],
    }));
  }, []);

  const clearChat = useCallback((roomId: string) => {
    setChatByRoom((previous) => ({ ...previous, [roomId]: [] }));
  }, []);

  const updatePreferences = useCallback((patch: Partial<Preferences>) => {
    setPreferences((previous) => ({ ...previous, ...patch }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    try {
      window.localStorage.removeItem(PREFERENCES_KEY);
    } catch {
      // Ignore storage failures; defaults are already applied.
    }
    setDialog(null);
    pushToast("Local preferences reset to defaults.");
  }, [pushToast]);

  const activeRooms = [...rooms]
    .filter(isRoomActive)
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.lastActiveAt.localeCompare(a.lastActiveAt),
    );

  const recentRooms = [...rooms]
    .filter((room) => room.status === "dormant" && !room.archived)
    .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));

  const store: AppStore = {
    view,
    rooms,
    activeRooms,
    recentRooms,
    preferences,
    dialog,
    toasts,
    chatByRoom,
    navigate,
    openDialog,
    closeDialog,
    openRoom,
    wakeRoom,
    createRoom,
    findRoomByInvitation,
    joinRoom,
    renameRoom,
    setRoomPassword,
    archiveRoom,
    unarchiveRoom,
    deleteRoom,
    simulatePartnerJoin,
    simulateDisconnect,
    simulateReconnect,
    endRoom,
    copyInvitation,
    sendChatMessage,
    clearChat,
    pushToast,
    dismissToast,
    updatePreferences,
    resetPreferences,
  };

  return (
    <AppStoreContext.Provider value={store}>
      {children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) {
    throw new Error("useAppStore must be used inside AppProvider");
  }
  return store;
}
