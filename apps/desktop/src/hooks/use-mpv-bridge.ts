import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

import type { LogEntry } from "../components/EventStream";
import {
  errorMessage,
  isTauriRuntime,
  mpv,
  type MpvEvent,
  type PlayerSnapshot,
} from "../lib/mpv";
import { useAppStore } from "../stores/app-store";

export const EMPTY_SNAPSHOT: PlayerSnapshot = {
  running: false,
  pid: null,
  position: null,
  duration: null,
  paused: true,
  speed: 1,
  volume: 100,
  muted: false,
  buffering: false,
  seeking: false,
  eof: false,
  hwdec: null,
  video: null,
  audio: null,
  tracks: [],
  title: null,
  path: null,
  frameDrops: null,
  decoderFrameDrops: null,
  lastError: null,
};

export const MEDIA_EXTENSIONS = [
  "mp4",
  "mkv",
  "webm",
  "avi",
  "mov",
  "m4v",
  "ts",
  "m2ts",
  "flv",
  "wmv",
  "mp3",
  "flac",
  "m4a",
  "opus",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface MpvBridge {
  tauri: boolean;
  snapshot: PlayerSnapshot;
  hasSnapshot: boolean;
  version: string | null;
  executable: string | null;
  entries: LogEntry[];
  busy: string | null;
  error: string | null;
  canControl: boolean;
  canPlay: boolean;
  subtitlesVisible: boolean;

  startEngine: () => Promise<void>;
  stopEngine: () => Promise<void>;
  restartEngine: () => Promise<void>;
  openTarget: (target: string) => Promise<void>;
  openFile: () => Promise<void>;
  togglePause: () => Promise<void>;
  seekBy: (delta: number) => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  changeRate: (rate: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  setProperty: (name: string, value: unknown) => Promise<void>;
  selectAudioTrack: (id: number) => Promise<void>;
  selectSubtitleTrack: (id: number | "no") => Promise<void>;
  toggleSubtitles: () => Promise<void>;
  clearEvents: () => void;
  clearError: () => void;
}

/**
 * Shared mpv bridge for the Developer Lab and the Cinema Room. One hook per
 * mounted screen; the Rust engine keeps running when the screen unmounts.
 */
export function useMpvBridge(): MpvBridge {
  const { preferences } = useAppStore();
  const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [executable, setExecutable] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subtitlesVisible, setSubtitlesVisible] = useState(true);
  const logId = useRef(0);
  const snapshotRef = useRef<PlayerSnapshot | null>(null);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  snapshotRef.current = snapshot;
  const tauri = isTauriRuntime();

  const pushEvent = useCallback((event: MpvEvent) => {
    const label = event.event ?? "event";
    const detail =
      event.line ??
      event.error ??
      event.reason ??
      (event.name ? `property: ${event.name}` : JSON.stringify(event));
    const entry: LogEntry = {
      id: (logId.current += 1),
      at: new Date().toLocaleTimeString([], { hour12: false }),
      event: label,
      detail: String(detail).slice(0, 240),
    };
    setEntries((previous) => [entry, ...previous].slice(0, 60));
  }, []);

  useEffect(() => {
    if (!tauri) return;
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    (async () => {
      try {
        const statusListener = await listen<PlayerSnapshot>(
          "mpv:status",
          (event) => setSnapshot(event.payload),
        );
        if (disposed) {
          statusListener();
          return;
        }
        unlisteners.push(statusListener);

        const eventListener = await listen<MpvEvent>("mpv:event", (event) =>
          pushEvent(event.payload),
        );
        if (disposed) {
          eventListener();
          return;
        }
        unlisteners.push(eventListener);

        const [initial, mpvPath] = await Promise.all([
          mpv.status(),
          mpv.executable(),
        ]);
        if (disposed) return;
        setSnapshot(initial);
        setExecutable(mpvPath);
        if (initial.running) {
          setVersion(await mpv.version().catch(() => null));
        }
      } catch (listenError) {
        if (!disposed) setError(errorMessage(listenError));
      }
    })();

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) unlisten();
    };
  }, [pushEvent, tauri]);

  const run = useCallback(
    async (label: string, action: () => Promise<void>) => {
      setBusy(label);
      setError(null);
      try {
        await action();
      } catch (actionError) {
        setError(errorMessage(actionError));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const applyPlayerDefaults = useCallback(async () => {
    const current = preferencesRef.current;
    await Promise.allSettled([
      mpv.setProperty("volume", current.defaultVolume),
      mpv.setProperty("sub-scale", current.subtitleScale),
      mpv.setSpeed(current.defaultSpeed),
    ]);
  }, []);

  const refreshVersion = useCallback(async () => {
    setVersion(await mpv.version().catch(() => null));
  }, []);

  const startEngine = useCallback(
    () =>
      run("start", async () => {
        if (!tauri) {
          throw new Error(
            "The native media engine is only available in the Tauri window.",
          );
        }
        const next = await mpv.start();
        setSnapshot(next);
        await refreshVersion();
        await applyPlayerDefaults();
      }),
    [applyPlayerDefaults, refreshVersion, run, tauri],
  );

  const stopEngine = useCallback(
    () =>
      run("stop", async () => {
        const next = await mpv.stop();
        setSnapshot(next);
        setVersion(null);
      }),
    [run],
  );

  const restartEngine = useCallback(
    () =>
      run("restart", async () => {
        await mpv.stop();
        const next = await mpv.start();
        setSnapshot(next);
        await refreshVersion();
        await applyPlayerDefaults();
      }),
    [applyPlayerDefaults, refreshVersion, run],
  );

  const openTarget = useCallback(
    (target: string) =>
      run("open", async () => {
        if (!snapshotRef.current?.running) {
          const started = await mpv.start();
          setSnapshot(started);
          await refreshVersion();
          await applyPlayerDefaults();
        }
        const next = await mpv.open(target);
        setSnapshot(next);
        setSubtitlesVisible(true);
      }),
    [applyPlayerDefaults, refreshVersion, run],
  );

  const openFile = useCallback(
    () =>
      run("file", async () => {
        if (!tauri) {
          throw new Error(
            "The native file picker is only available in the Tauri window.",
          );
        }
        const selected = await open({
          multiple: false,
          directory: false,
          title: "Open media",
          filters: [{ name: "Media", extensions: MEDIA_EXTENSIONS }],
        });
        if (typeof selected !== "string") return;
        if (!snapshotRef.current?.running) {
          const started = await mpv.start();
          setSnapshot(started);
          await refreshVersion();
          await applyPlayerDefaults();
        }
        const next = await mpv.open(selected);
        setSnapshot(next);
        setSubtitlesVisible(true);
      }),
    [applyPlayerDefaults, refreshVersion, run, tauri],
  );

  const togglePause = useCallback(
    () =>
      run("toggle", async () => {
        const current = snapshotRef.current;
        if (!current?.path) {
          throw new Error("Open a local file or a direct media URL first.");
        }
        await mpv.togglePause();
      }),
    [run],
  );

  const seekBy = useCallback(
    (delta: number) =>
      run("seek", async () => {
        const current = snapshotRef.current;
        if (!current?.running) return;
        const start = current.position ?? 0;
        const upper = current.duration ?? Number.POSITIVE_INFINITY;
        const target = clamp(start + delta, 0, upper);
        await mpv.seek(target);
      }),
    [run],
  );

  const seekTo = useCallback(
    (position: number) =>
      run("seek", async () => {
        const current = snapshotRef.current;
        if (!current?.running) return;
        const upper = current.duration ?? Number.POSITIVE_INFINITY;
        await mpv.seek(clamp(position, 0, upper));
      }),
    [run],
  );

  const changeRate = useCallback(
    (rate: number) =>
      run("rate", async () => {
        if (!snapshotRef.current?.running) return;
        await mpv.setSpeed(rate);
      }),
    [run],
  );

  const setVolume = useCallback(
    (volume: number) =>
      run("volume", async () => {
        if (!snapshotRef.current?.running) return;
        await mpv.setProperty("volume", clamp(Math.round(volume), 0, 100));
      }),
    [run],
  );

  const toggleMute = useCallback(
    () =>
      run("mute", async () => {
        const current = snapshotRef.current;
        if (!current?.running) return;
        await mpv.setProperty("mute", !current.muted);
      }),
    [run],
  );

  const toggleFullscreen = useCallback(
    () =>
      run("fullscreen", async () => {
        if (!snapshotRef.current?.running) return;
        await mpv.setProperty("fullscreen", true);
      }),
    [run],
  );

  const setProperty = useCallback(
    (name: string, value: unknown) =>
      run("property", async () => {
        if (!snapshotRef.current?.running) return;
        await mpv.setProperty(name, value);
      }),
    [run],
  );

  const selectAudioTrack = useCallback(
    (id: number) => setProperty("aid", id),
    [setProperty],
  );

  const selectSubtitleTrack = useCallback(
    (id: number | "no") => {
      setSubtitlesVisible(id !== "no");
      return setProperty("sid", id === "no" ? "no" : id);
    },
    [setProperty],
  );

  const toggleSubtitles = useCallback(
    () =>
      run("subtitles", async () => {
        const current = snapshotRef.current;
        if (!current?.running) return;
        const next = !subtitlesVisible;
        await mpv.setProperty("sub-visibility", next);
        setSubtitlesVisible(next);
      }),
    [run, subtitlesVisible],
  );

  const clearEvents = useCallback(() => setEntries([]), []);
  const clearError = useCallback(() => setError(null), []);

  const view = snapshot ?? EMPTY_SNAPSHOT;
  const canControl = tauri && view.running && busy === null;

  return {
    tauri,
    snapshot: view,
    hasSnapshot: snapshot !== null,
    version,
    executable,
    entries,
    busy,
    error,
    canControl,
    canPlay: canControl && Boolean(view.path),
    subtitlesVisible,
    startEngine,
    stopEngine,
    restartEngine,
    openTarget,
    openFile,
    togglePause,
    seekBy,
    seekTo,
    changeRate,
    setVolume,
    toggleMute,
    toggleFullscreen,
    setProperty,
    selectAudioTrack,
    selectSubtitleTrack,
    toggleSubtitles,
    clearEvents,
    clearError,
  };
}
