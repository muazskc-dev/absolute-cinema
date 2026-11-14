import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  AlertTriangle,
  CircleStop,
  Film,
  FolderOpen,
  Link2,
  Loader2,
  Pause,
  Play,
  Power,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import type { MpvEvent, PlayerSnapshot } from "../../lib/mpv";
import { errorMessage, isTauriRuntime, mpv } from "../../lib/mpv";
import { basename, formatRate, formatTime, shortError } from "../../lib/format";
import { DiagnosticsPanel } from "../../components/DiagnosticsPanel";
import { EventStream, type LogEntry } from "../../components/EventStream";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

const EMPTY_SNAPSHOT: PlayerSnapshot = {
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

const MEDIA_EXTENSIONS = [
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

export function MediaLab() {
  const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [executable, setExecutable] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [scrub, setScrub] = useState<number | null>(null);
  const logId = useRef(0);
  const tauri = isTauriRuntime();
  const view = snapshot ?? EMPTY_SNAPSHOT;

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
        const statusListener = await listen<PlayerSnapshot>("mpv:status", (event) => {
          setSnapshot(event.payload);
        });
        if (disposed) {
          statusListener();
          return;
        }
        unlisteners.push(statusListener);

        const eventListener = await listen<MpvEvent>("mpv:event", (event) => {
          pushEvent(event.payload);
        });
        if (disposed) {
          eventListener();
          return;
        }
        unlisteners.push(eventListener);

        const [initial, mpvPath] = await Promise.all([mpv.status(), mpv.executable()]);
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

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusy(null);
    }
  };

  const startEngine = () =>
    run("start", async () => {
      const next = await mpv.start();
      setSnapshot(next);
      setVersion(await mpv.version().catch(() => null));
    });

  const stopEngine = () =>
    run("stop", async () => {
      const next = await mpv.stop();
      setSnapshot(next);
      setVersion(null);
      setScrub(null);
    });

  const openTarget = (target: string) =>
    run("open", async () => {
      if (!view.running) {
        const started = await mpv.start();
        setSnapshot(started);
        setVersion(await mpv.version().catch(() => null));
      }
      const next = await mpv.open(target);
      setSnapshot(next);
      setScrub(null);
    });

  const openFile = () =>
    run("file", async () => {
      const selected = await open({
        multiple: false,
        directory: false,
        title: "Open media",
        filters: [{ name: "Media", extensions: MEDIA_EXTENSIONS }],
      });
      if (typeof selected !== "string") return;
      await openTarget(selected);
    });

  const loadUrl = () => {
    const target = url.trim();
    if (!/^https?:\/\//i.test(target)) {
      setError("Enter a direct http:// or https:// media URL.");
      return;
    }
    void openTarget(target);
  };

  const toggle = () =>
    run("toggle", async () => {
      if (!view.path) {
        setError("Open a local file or a direct media URL first.");
        return;
      }
      await mpv.togglePause();
    });

  const seekBy = (delta: number) =>
    run("seek", async () => {
      if (!view.running) return;
      const current = view.position ?? 0;
      const upper = view.duration ?? Number.POSITIVE_INFINITY;
      const target = Math.min(Math.max(current + delta, 0), upper);
      await mpv.seek(target);
    });

  const commitScrub = () => {
    if (scrub == null) return;
    const target = scrub;
    setScrub(null);
    void run("seek", () => mpv.seek(target));
  };

  const changeRate = (rate: number) =>
    run("rate", async () => {
      if (!view.running) return;
      await mpv.setSpeed(rate);
    });

  const duration = view.duration ?? 0;
  const position = scrub ?? view.position ?? 0;
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const displayTitle = view.title || basename(view.path);
  const disabled = !tauri || busy !== null;
  const canControl = tauri && view.running && busy === null;
  const canPlay = canControl && Boolean(view.path);

  return (
    <div className="mx-auto max-w-[1480px] px-8 py-6">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-accent/40 bg-accent-soft">
            <span className="font-display text-2xl leading-none text-accent">A</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[15px] font-semibold tracking-[0.18em] text-paper">
                ABSOLUTE-CINEMA
              </h1>
              <span className="rounded-full border border-line px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-muted">
                Sprint 0
              </span>
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-[0.26em] text-faint">
              Private cinema · perfect synchronization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden max-w-[360px] truncate font-mono text-[10px] text-faint xl:block">
            {executable ?? "mpv not detected"}
          </span>
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[10px] text-muted">
            <span
              className={
                view.running
                  ? "h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : "h-1.5 w-1.5 rounded-full bg-faint"
              }
            />
            <span className="uppercase tracking-[0.16em]">
              {view.running
                ? `engine live${view.pid ? ` · ${view.pid}` : ""}`
                : "engine idle"}
            </span>
          </div>
        </div>
      </div>

      <section className="mt-8 flex items-end justify-between gap-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">
            Media proof of concept
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl leading-[1.05] tracking-[-0.02em] text-paper">
            One film. Two rooms. One timeline.
          </h2>
          <p className="mt-4 max-w-2xl text-[13px] leading-6 text-muted">
            Sprint 0 validates the local media engine before the room and sync layers exist.
            mpv owns decode and render; Rust owns the process; the UI only issues commands and
            reports what actually happened.
          </p>
        </div>
        <div className="hidden shrink-0 gap-8 border-l border-line pl-8 text-right lg:flex">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-faint">Target</p>
            <p className="mt-1 font-mono text-sm text-paper">4K / 8K</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-faint">Decode</p>
            <p className="mt-1 font-mono text-sm text-paper">
              {view.hwdec ?? "D3D11VA"}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-faint">Media path</p>
            <p className="mt-1 font-mono text-sm text-paper">LOCAL</p>
          </div>
        </div>
      </section>

      {!tauri && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            Browser preview cannot spawn native processes. Run{" "}
            <code className="font-mono text-amber-100">pnpm dev</code> from the repository root
            to open the Tauri window.
          </span>
        </div>
      )}

      {(error || view.lastError) && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-xs text-paper">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-accent" />
          <span className="min-w-0 break-words">
            {error ? shortError(error, 400) : shortError(view.lastError ?? "", 400)}
          </span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          className="min-w-0"
        >
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted">
                <Film size={12} />
                <span>Player deck</span>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                local playback · client-side
              </span>
            </div>

            <div className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_20%,rgba(225,29,46,0.12),transparent_55%),linear-gradient(180deg,#08080a_0%,#000_100%)] px-6 py-8">
              <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:100%_4px]" />
              <div className="relative flex min-h-[300px] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-black/40">
                  {view.running ? (
                    <Power size={22} className="text-accent" />
                  ) : (
                    <Power size={22} className="text-faint" />
                  )}
                </div>
                <p className="mt-5 max-w-xl truncate font-display text-2xl text-paper">
                  {view.path ? displayTitle : "No media loaded"}
                </p>
                <p className="mt-2 max-w-lg text-[11px] leading-5 text-faint">
                  {view.running
                    ? view.path
                      ? "mpv is rendering in its own window. Use this deck to control it."
                      : "Engine is idle. Open a local file or paste a direct video URL."
                    : "Start the engine, then open a file. mpv renders in a separate window during Sprint 0."}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    {view.video?.width && view.video?.height
                      ? `${view.video.width}×${view.video.height}`
                      : "resolution —"}
                  </span>
                  <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    {view.video?.codec ?? "codec —"}
                  </span>
                  <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    {view.hwdec ? `hwdec ${view.hwdec}` : "hwdec —"}
                  </span>
                  {view.buffering && (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-300">
                      buffering
                    </span>
                  )}
                  {view.eof && (
                    <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                      end of file
                    </span>
                  )}
                </div>
              </div>

              <div className="relative mt-2 flex items-center justify-between font-mono text-[10px] text-faint">
                <span>{formatTime(position)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={duration > 0 ? duration : 1}
                step={0.1}
                value={duration > 0 ? Math.min(position, duration) : 0}
                disabled={!canControl || duration <= 0}
                onChange={(event) => setScrub(Number(event.target.value))}
                onPointerUp={commitScrub}
                onPointerCancel={() => setScrub(null)}
                onKeyUp={(event) => {
                  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                    commitScrub();
                  }
                }}
                aria-label="Playback position"
                className="cinema-range relative mt-1 w-full"
                style={{
                  background: `linear-gradient(to right, #e11d2e 0%, #e11d2e ${progress}%, #232327 ${progress}%, #232327 100%)`,
                }}
              />

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggle}
                  disabled={!canPlay}
                  className="flex h-11 items-center gap-2.5 rounded-lg bg-accent px-5 text-[12px] font-medium text-white transition hover:bg-[#f0263a] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {busy === "toggle" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : view.paused ? (
                    <Play size={15} fill="currentColor" />
                  ) : (
                    <Pause size={15} fill="currentColor" />
                  )}
                  {view.paused ? "Play" : "Pause"}
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(-10)}
                  disabled={!canControl}
                  className="flex h-11 items-center gap-1.5 rounded-lg border border-line bg-raised px-3.5 text-[11px] text-paper transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-35"
                  title="Back 10 seconds"
                >
                  <SkipBack size={14} /> 10
                </button>
                <button
                  type="button"
                  onClick={() => seekBy(10)}
                  disabled={!canControl}
                  className="flex h-11 items-center gap-1.5 rounded-lg border border-line bg-raised px-3.5 text-[11px] text-paper transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-35"
                  title="Forward 10 seconds"
                >
                  10 <SkipForward size={14} />
                </button>

                <div className="ml-auto flex items-center gap-1 rounded-lg border border-line bg-black/40 p-1">
                  {RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => changeRate(rate)}
                      disabled={!canControl}
                      className={`h-8 rounded-md px-2.5 font-mono text-[10px] transition disabled:cursor-not-allowed disabled:opacity-35 ${
                        Math.abs(view.speed - rate) < 0.001
                          ? "bg-accent-soft text-accent"
                          : "text-muted hover:text-paper"
                      }`}
                      title={`Playback rate ${formatRate(rate)}`}
                    >
                      {formatRate(rate)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-line px-5 py-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {!view.running ? (
                  <button
                    type="button"
                    onClick={startEngine}
                    disabled={disabled}
                    className="flex h-10 items-center gap-2 rounded-lg bg-paper px-4 text-[11px] font-medium text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy === "start" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Power size={14} />
                    )}
                    Start engine
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={openFile}
                      disabled={disabled}
                      className="flex h-10 items-center gap-2 rounded-lg border border-line bg-raised px-3.5 text-[11px] text-paper transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busy === "file" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <FolderOpen size={14} />
                      )}
                      Open local file
                    </button>
                    <button
                      type="button"
                      onClick={stopEngine}
                      disabled={disabled}
                      className="flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-[11px] text-muted transition hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busy === "stop" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CircleStop size={14} />
                      )}
                      Stop
                    </button>
                  </>
                )}

                <div className="min-w-[220px] flex-1">
                  <div className="flex h-10 items-center gap-1 rounded-lg border border-line bg-black/40 px-1.5">
                    <Link2 size={13} className="ml-2 shrink-0 text-faint" />
                    <input
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") loadUrl();
                      }}
                      placeholder="https://example.com/movie.mp4"
                      disabled={disabled}
                      className="h-8 min-w-0 flex-1 bg-transparent px-1 font-mono text-[10px] text-paper outline-none placeholder:text-faint/70"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={loadUrl}
                      disabled={disabled}
                      className="h-8 rounded-md border border-line px-3 text-[10px] uppercase tracking-[0.12em] text-muted transition hover:border-line-strong hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Load
                    </button>
                  </div>
                </div>

                {view.running && (
                  <button
                    type="button"
                    onClick={() =>
                      run("restart", async () => {
                        await mpv.stop();
                        const next = await mpv.start();
                        setSnapshot(next);
                        setVersion(await mpv.version().catch(() => null));
                      })
                    }
                    disabled={disabled}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-faint transition hover:border-line-strong hover:text-paper disabled:opacity-40"
                    title="Restart engine"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>

              <p className="mt-3 text-[10px] leading-5 text-faint">
                Local paths never leave this machine. Direct URLs are played by mpv on this
                client, not fetched by the server.
              </p>
            </div>
          </div>
        </motion.main>

        <div className="flex min-w-0 flex-col gap-5">
          <DiagnosticsPanel
            snapshot={view}
            version={version}
            executable={executable}
          />
          <EventStream entries={entries} onClear={() => setEntries([])} />
        </div>
      </div>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[10px] text-faint">
        <span>Media stays local. The server never receives video bytes.</span>
        <span className="font-mono">build 0.1.0 · sprint 0 · mpv {version ?? "—"}</span>
      </footer>
    </div>
  );
}
