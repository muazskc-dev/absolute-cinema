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
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-2 last:border-b-0">
      <span className="text-[10px] uppercase tracking-[0.18em] text-faint">{label}</span>
      <span
        className={`max-w-[62%] truncate text-right text-[12px] text-paper ${
          mono ? "font-mono text-[11px]" : ""
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
    <div className="border-b border-line px-5 py-4 last:border-b-0">
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted">
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
    video?.width && video?.height ? `${video.width} × ${video.height}` : "—";
  const audioTracks = snapshot.tracks.filter((track) => track.type === "audio");
  const subtitleTracks = snapshot.tracks.filter((track) => track.type === "sub");

  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-accent">Signal</p>
          <h2 className="mt-1 text-sm font-medium text-paper">Playback telemetry</h2>
        </div>
        <span className="rounded-full border border-line px-2 py-1 font-mono text-[9px] text-faint">
          {snapshot.running ? "IPC LIVE" : "NO PROCESS"}
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
            [video?.colorPrimaries, video?.gamma].filter(Boolean).join(" / ") || "—"
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
          <p className="py-1 text-[11px] text-faint">No tracks reported yet.</p>
        ) : (
          <div className="space-y-1.5">
            {[...audioTracks, ...subtitleTracks].slice(0, 8).map((track, index) => (
              <div
                key={`${track.type}-${track.id ?? index}`}
                className="flex items-center justify-between gap-3 text-[11px]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={
                      track.selected
                        ? "h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                        : "h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong"
                    }
                  />
                  <span className="truncate text-paper/90">
                    {track.title || track.language || `${track.type} ${track.id ?? ""}`}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase text-faint">
                  {track.type} {track.codec ? `· ${track.codec}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-faint">Binary</p>
        <p className="mt-2 break-all font-mono text-[10px] leading-5 text-muted">
          {executable ?? "mpv not found — install mpv or set ABSOLUTE_CINEMA_MPV"}
        </p>
      </div>
    </motion.aside>
  );
}
