import type { ReactNode } from "react";
import { motion } from "motion/react";
import { AudioLines, Cpu, Gauge, MonitorPlay } from "lucide-react";

import type { PlayerSnapshot } from "../lib/mpv";

interface DiagnosticsPanelProps {
  snapshot: PlayerSnapshot;
  version: string | null;
  executable: string | null;
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-subtle py-1.5 last:border-b-0">
      <span className="text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
        {label}
      </span>
      <span
        className={`max-w-[62%] truncate text-right text-[11px] text-ink ${
          mono ? "font-mono text-[10px]" : ""
        }`}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-line-subtle px-4 py-3 last:border-b-0">
      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-secondary">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

export function DiagnosticsPanel({
  snapshot,
  version,
  executable,
}: DiagnosticsPanelProps) {
  const video = snapshot.video;
  const audio = snapshot.audio;
  const resolution =
    video?.width && video?.height
      ? `${video.width} × ${video.height}`
      : "—";
  const audioTracks = snapshot.tracks.filter((track) => track.type === "audio");
  const subtitleTracks = snapshot.tracks.filter((track) => track.type === "sub");

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      aria-label="Playback telemetry"
      className="overflow-hidden rounded-xl border border-line-subtle bg-surface-1"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-secondary">
            Signal
          </p>
          <h2 className="mt-0.5 text-[12px] font-medium text-ink">
            Playback telemetry
          </h2>
        </div>
        <span className="rounded border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-secondary">
          {snapshot.running ? "IPC live" : "No process"}
        </span>
      </div>

      <Section icon={<Gauge size={12} />} title="Engine">
        <Row label="mpv" value={version ?? "not queried"} mono />
        <Row label="hwdec" value={snapshot.hwdec ?? "not reported"} mono />
        <Row label="pid" value={snapshot.pid ?? "—"} mono />
        <Row
          label="drops"
          value={`${snapshot.frameDrops ?? 0} / ${snapshot.decoderFrameDrops ?? 0}`}
          mono
        />
        <Row
          label="state"
          value={
            snapshot.buffering
              ? "buffering"
              : snapshot.eof
                ? "end of file"
                : snapshot.paused
                  ? "paused"
                  : "playing"
          }
        />
      </Section>

      <Section icon={<MonitorPlay size={12} />} title="Video">
        <Row label="resolution" value={resolution} mono />
        <Row label="codec" value={video?.codec ?? "—"} mono />
        <Row label="pixel" value={video?.pixelFormat ?? "—"} mono />
        <Row label="hw pixel" value={video?.hwPixelFormat ?? "—"} mono />
        <Row
          label="color"
          value={
            [video?.colorPrimaries, video?.gamma].filter(Boolean).join(" / ") ||
            "—"
          }
          mono
        />
      </Section>

      <Section icon={<AudioLines size={12} />} title="Audio">
        <Row label="codec" value={audio?.codec ?? "—"} mono />
        <Row
          label="channels"
          value={audio?.channels != null ? String(audio.channels) : "—"}
          mono
        />
        <Row
          label="rate"
          value={audio?.sampleRate != null ? `${audio.sampleRate} Hz` : "—"}
          mono
        />
        <Row label="layout" value={audio?.channelLayout ?? "—"} mono />
      </Section>

      <Section icon={<Cpu size={12} />} title="Tracks">
        {audioTracks.length === 0 && subtitleTracks.length === 0 ? (
          <p className="py-1 text-[11px] text-ink-secondary">
            No tracks reported yet.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {[...audioTracks, ...subtitleTracks]
              .slice(0, 8)
              .map((track, index) => (
                <div
                  key={`${track.type}-${track.id ?? index}`}
                  className="flex items-center justify-between gap-3 text-[11px]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={
                        track.selected
                          ? "size-1.5 shrink-0 rounded-full bg-ink"
                          : "size-1.5 shrink-0 rounded-full border border-ink-muted"
                      }
                    />
                    <span className="truncate text-ink">
                      {track.title ||
                        track.language ||
                        `${track.type} ${track.id ?? ""}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase text-ink-secondary">
                    {track.type} {track.codec ? `· ${track.codec}` : ""}
                  </span>
                </div>
              ))}
          </div>
        )}
      </Section>

      <div className="px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
          Binary
        </p>
        <p className="mt-1.5 break-all font-mono text-[10px] leading-4 text-ink-secondary">
          {executable ?? "mpv not found — install mpv or set ABSOLUTE_CINEMA_MPV"}
        </p>
      </div>
    </motion.section>
  );
}
