import { invoke } from "@tauri-apps/api/core";

export interface VideoInfo {
  codec: string | null;
  width: number | null;
  height: number | null;
  pixelFormat: string | null;
  hwPixelFormat: string | null;
  colorPrimaries: string | null;
  gamma: string | null;
}

export interface AudioInfo {
  codec: string | null;
  sampleRate: number | null;
  channels: number | null;
  channelLayout: string | null;
}

export interface TrackInfo {
  id: number | null;
  type: string | null;
  title: string | null;
  language: string | null;
  codec: string | null;
  selected: boolean;
  external: boolean;
  default: boolean;
}

export interface PlayerSnapshot {
  running: boolean;
  pid: number | null;
  position: number | null;
  duration: number | null;
  paused: boolean;
  speed: number;
  volume: number;
  muted: boolean;
  buffering: boolean;
  seeking: boolean;
  eof: boolean;
  hwdec: string | null;
  video: VideoInfo | null;
  audio: AudioInfo | null;
  tracks: TrackInfo[];
  title: string | null;
  path: string | null;
  frameDrops: number | null;
  decoderFrameDrops: number | null;
  lastError: string | null;
}

export interface MpvEvent {
  event?: string;
  name?: string;
  line?: string;
  error?: string;
  reason?: string;
  [key: string]: unknown;
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export const mpv = {
  start: () => invoke<PlayerSnapshot>("mpv_start"),
  stop: () => invoke<PlayerSnapshot>("mpv_stop"),
  status: () => invoke<PlayerSnapshot>("mpv_status"),
  open: (target: string) => invoke<PlayerSnapshot>("mpv_open", { target }),
  play: () => invoke<void>("mpv_play"),
  pause: () => invoke<void>("mpv_pause"),
  togglePause: () => invoke<boolean>("mpv_toggle_pause"),
  seek: (position: number, relative = false) =>
    invoke<void>("mpv_seek", { position, relative }),
  setSpeed: (speed: number) => invoke<void>("mpv_set_speed", { speed }),
  setProperty: (name: string, value: unknown) =>
    invoke<void>("mpv_set_property", { name, value }),
  version: () => invoke<string>("mpv_version"),
  executable: () => invoke<string | null>("mpv_executable"),
};
