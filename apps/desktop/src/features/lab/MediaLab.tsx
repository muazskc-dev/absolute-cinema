import {
  AlertTriangle,
  CircleStop,
  ClipboardCopy,
  FlaskConical,
  Loader2,
  Power,
  RotateCcw,
} from "lucide-react";

import { useMpvBridge } from "../../hooks/use-mpv-bridge";
import { APP_VERSION } from "../../lib/app-info";
import { copyText } from "../../lib/clipboard";
import { shortError } from "../../lib/format";
import { useAppStore } from "../../stores/app-store";
import { PageContainer, PageHeader } from "../../components/layout/Page";
import { DiagnosticsPanel } from "../../components/DiagnosticsPanel";
import { EventStream } from "../../components/EventStream";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Notice";
import { PlayerControls } from "../player/PlayerControls";
import { PlayerSurface } from "../player/PlayerSurface";
import { SourceBar } from "../player/SourceBar";

export function MediaLab() {
  const bridge = useMpvBridge();
  const { pushToast } = useAppStore();
  const { snapshot, tauri, busy, error } = bridge;
  const busyNow = busy !== null;
  const mediaError = error ?? snapshot.lastError;

  const copyDiagnostics = async () => {
    const lines = [
      `ABSOLUTE-CINEMA ${APP_VERSION}`,
      `mpv: ${bridge.version ?? "not queried"}`,
      `executable: ${bridge.executable ?? "not detected"}`,
      `running: ${snapshot.running}`,
      `pid: ${snapshot.pid ?? "—"}`,
      `hwdec: ${snapshot.hwdec ?? "—"}`,
      `position: ${snapshot.position ?? "—"}`,
      `duration: ${snapshot.duration ?? "—"}`,
      `frame drops: ${snapshot.frameDrops ?? 0} / ${snapshot.decoderFrameDrops ?? 0}`,
      `video: ${snapshot.video ? JSON.stringify(snapshot.video) : "none"}`,
      `audio: ${snapshot.audio ? JSON.stringify(snapshot.audio) : "none"}`,
      `tracks: ${snapshot.tracks.length}`,
      `last error: ${snapshot.lastError ?? "none"}`,
    ];
    const copied = await copyText(lines.join("\n"));
    pushToast(
      copied
        ? "Diagnostics copied to the clipboard."
        : "Could not copy diagnostics.",
      copied ? "info" : "error",
    );
  };

  return (
    <PageContainer wide>
      <PageHeader
        eyebrow="Sprint 0 media proof"
        title="Developer lab"
        description="The original media engine, preserved. mpv owns decode and render, Rust owns the process, and this deck only issues commands and reports what actually happened."
        actions={
          <>
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-surface-1 px-2.5 font-mono text-[10px] text-ink-secondary">
              <span
                aria-hidden
                className={
                  snapshot.running
                    ? "size-1.5 rounded-full bg-ink"
                    : "size-1.5 rounded-full border border-ink-muted"
                }
              />
              {snapshot.running
                ? `engine live${snapshot.pid ? ` · ${snapshot.pid}` : ""}`
                : "engine idle"}
            </span>

            {!snapshot.running ? (
              <Button
                variant="primary"
                icon={
                  busy === "start" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Power size={15} />
                  )
                }
                onClick={() => void bridge.startEngine()}
                disabled={!tauri || busyNow}
              >
                Start engine
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  icon={
                    busy === "stop" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CircleStop size={15} />
                    )
                  }
                  onClick={() => void bridge.stopEngine()}
                  disabled={busyNow}
                >
                  Stop
                </Button>
                <Button
                  variant="ghost"
                  icon={<RotateCcw size={15} />}
                  onClick={() => void bridge.restartEngine()}
                  disabled={busyNow}
                >
                  Restart
                </Button>
              </>
            )}

            <Button
              variant="ghost"
              icon={<ClipboardCopy size={15} />}
              onClick={() => void copyDiagnostics()}
            >
              Copy diagnostics
            </Button>
          </>
        }
      />

      {!tauri ? (
        <div className="mb-4">
          <Notice
            icon={<AlertTriangle size={14} />}
            title="Browser preview"
          >
            The browser preview cannot spawn native processes. Run the Tauri
            window to use the media engine.
          </Notice>
        </div>
      ) : null}

      {mediaError ? (
        <div className="mb-4 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Notice icon={<AlertTriangle size={14} />} title="Media engine error">
              {shortError(mediaError, 400)}
            </Notice>
          </div>
          {error ? (
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0"
              onClick={bridge.clearError}
            >
              Dismiss
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 min-[1180px]:grid-cols-[1.618fr_1fr]">
        <div className="min-w-0">
          <PlayerSurface
            bridge={bridge}
            context="lab"
            onOpenFile={() => void bridge.openFile()}
          />
          <div className="mt-2 overflow-hidden rounded-xl border border-line bg-surface-1">
            <PlayerControls bridge={bridge} />
          </div>
          <div className="mt-3">
            <SourceBar bridge={bridge} />
          </div>

          <section className="mt-4 flex items-start gap-2.5 border-t border-line-subtle pt-3">
            <FlaskConical
              size={13}
              className="mt-0.5 shrink-0 text-ink-secondary"
              aria-hidden
            />
            <p className="text-[11px] leading-4 text-ink-secondary">
              Direct URLs are played by mpv on this client, not fetched by a
              server. Local paths never leave this machine. Embedded video is
              deliberately not part of Sprint 1.
            </p>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <DiagnosticsPanel
            snapshot={snapshot}
            version={bridge.version}
            executable={bridge.executable}
          />
          <EventStream entries={bridge.entries} onClear={bridge.clearEvents} />
        </div>
      </div>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-4 text-[10px] text-ink-secondary">
        <span>Media stays local. The server never receives video bytes.</span>
        <span className="font-mono">
          build 0.1.0 · sprint 1 · mpv {bridge.version ?? "not queried"}
        </span>
      </footer>
    </PageContainer>
  );
}
