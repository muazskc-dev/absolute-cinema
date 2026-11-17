import { Film, FolderOpen, Loader2, MonitorX, Power } from "lucide-react";

import type { MpvBridge } from "../../hooks/use-mpv-bridge";
import { basename } from "../../lib/format";
import { Button } from "../../components/ui/Button";

function CornerTicks() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-4">
      <span className="absolute left-0 top-0 size-2.5 border-l border-t border-white/20" />
      <span className="absolute right-0 top-0 size-2.5 border-r border-t border-white/20" />
      <span className="absolute bottom-0 left-0 size-2.5 border-b border-l border-white/20" />
      <span className="absolute bottom-0 right-0 size-2.5 border-b border-r border-white/20" />
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-line px-2 py-1 font-mono text-[10px] text-ink-secondary">
      {children}
    </span>
  );
}

export function PlayerSurface({
  bridge,
  onOpenFile,
  context = "cinema",
}: {
  bridge: MpvBridge;
  onOpenFile: () => void;
  context?: "cinema" | "lab";
}) {
  const { snapshot, tauri, busy } = bridge;
  const directUrl = /^https?:\/\//i.test(snapshot.path ?? "");
  const displayTitle = snapshot.title || basename(snapshot.path);
  const playbackState = snapshot.eof
    ? "End of file"
    : snapshot.buffering
      ? "Buffering"
      : snapshot.seeking
        ? "Seeking"
        : snapshot.paused
          ? "Paused"
          : "Playing";

  return (
    <section
      aria-label="Media surface"
      className="overflow-hidden rounded-xl border border-line bg-surface-1"
    >
      <header className="flex items-center justify-between gap-4 border-b border-line-subtle px-4 py-2.5">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">
          <Film size={12} aria-hidden />
          <span>{context === "lab" ? "Player deck" : "Cinema surface"}</span>
        </div>
        <span className="truncate font-mono text-[10px] text-ink-secondary">
          {snapshot.running
            ? `mpv${snapshot.pid ? ` · pid ${snapshot.pid}` : " · running"}`
            : "mpv · idle"}
        </span>
      </header>

      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black px-8">
        <CornerTicks />

        {!tauri ? (
          <div className="flex max-w-[420px] flex-col items-center text-center">
            <span className="grid size-11 place-items-center rounded-full border border-line text-ink-secondary">
              <MonitorX size={18} aria-hidden />
            </span>
            <h3 className="mt-4 text-[14px] font-medium text-ink">
              Native engine unavailable
            </h3>
            <p className="mt-1.5 text-[12px] leading-5 text-ink-secondary">
              The browser preview cannot spawn mpv. Run the Tauri window to use
              the media engine.
            </p>
          </div>
        ) : !snapshot.running ? (
          <div className="flex max-w-[420px] flex-col items-center text-center">
            <span className="grid size-11 place-items-center rounded-full border border-line text-ink-secondary">
              {busy === "start" ? (
                <Loader2 size={18} className="animate-spin" aria-hidden />
              ) : (
                <Power size={18} aria-hidden />
              )}
            </span>
            <h3 className="mt-4 text-[14px] font-medium text-ink">
              Engine idle
            </h3>
            <p className="mt-1.5 text-[12px] leading-5 text-ink-secondary">
              Start mpv, then open a local file or a direct media URL. Video
              renders in mpv&apos;s own window, not inside this panel.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              icon={<Power size={14} />}
              onClick={() => void bridge.startEngine()}
              disabled={busy !== null}
            >
              Start engine
            </Button>
          </div>
        ) : !snapshot.path ? (
          <div className="flex max-w-[420px] flex-col items-center text-center">
            <span className="grid size-11 place-items-center rounded-full border border-line text-ink-secondary">
              <Film size={18} aria-hidden />
            </span>
            <h3 className="mt-4 text-[14px] font-medium text-ink">
              Ready for a source
            </h3>
            <p className="mt-1.5 text-[12px] leading-5 text-ink-secondary">
              The engine is running. Open a local file or paste a direct HTTP
              media URL. mpv opens its own playback window.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              icon={<FolderOpen size={14} />}
              onClick={onOpenFile}
              disabled={busy !== null}
            >
              Open local file
            </Button>
          </div>
        ) : (
          <div className="flex w-full max-w-[560px] flex-col items-center text-center">
            <span className="rounded border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary">
              {directUrl ? "Direct URL" : "Local file"}
            </span>
            <h3
              className="mt-4 line-clamp-2 max-w-full text-[22px] font-medium leading-7 tracking-[-0.01em] text-ink"
              title={snapshot.path}
            >
              {displayTitle}
            </h3>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <Chip>{playbackState}</Chip>
              {snapshot.video?.width && snapshot.video?.height ? (
                <Chip>
                  {snapshot.video.width}×{snapshot.video.height}
                </Chip>
              ) : null}
              {snapshot.video?.codec ? <Chip>{snapshot.video.codec}</Chip> : null}
              {snapshot.hwdec ? <Chip>hwdec {snapshot.hwdec}</Chip> : null}
            </div>
            <p className="mt-4 max-w-[400px] text-[11px] leading-5 text-ink-secondary">
              Video is rendering in mpv&apos;s separate window. This surface is
              the control deck and shows real telemetry only.
            </p>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle px-4 py-2.5">
        <p className="text-[10px] leading-4 text-ink-secondary">
          mpv renders in its own window. Embedded playback remains later,
          gated work.
        </p>
        <span className="font-mono text-[10px] text-ink-secondary">
          {snapshot.running ? "IPC connected" : "IPC idle"}
        </span>
      </footer>
    </section>
  );
}
