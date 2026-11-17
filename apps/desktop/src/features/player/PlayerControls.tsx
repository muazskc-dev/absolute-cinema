import { useEffect, useState, type ReactNode } from "react";
import {
  Captions,
  CaptionsOff,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";

import type { MpvBridge } from "../../hooks/use-mpv-bridge";
import { formatRate, formatTime } from "../../lib/format";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { Range } from "../../components/ui/Range";
import { Select } from "../../components/ui/Select";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function ControlGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1.5">{children}</div>;
}

export function PlayerControls({ bridge }: { bridge: MpvBridge }) {
  const { snapshot, canControl } = bridge;
  const [scrub, setScrub] = useState<number | null>(null);
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);

  const duration = snapshot.duration ?? 0;
  const position = scrub ?? snapshot.position ?? 0;
  const volume = volumeDraft ?? snapshot.volume;

  useEffect(() => {
    if (!snapshot.running) {
      setScrub(null);
      setVolumeDraft(null);
    }
  }, [snapshot.running]);

  const commitScrub = () => {
    if (scrub == null) return;
    const target = scrub;
    setScrub(null);
    void bridge.seekTo(target);
  };

  const commitVolume = () => {
    if (volumeDraft == null) return;
    const target = volumeDraft;
    setVolumeDraft(null);
    void bridge.setVolume(target);
  };

  const speedOptions = RATES.includes(
    snapshot.speed as (typeof RATES)[number],
  )
    ? RATES
    : [...RATES, snapshot.speed].sort((a, b) => a - b);

  const audioTracks = snapshot.tracks.filter(
    (track) => track.type === "audio" && track.id != null,
  );
  const subtitleTracks = snapshot.tracks.filter(
    (track) => track.type === "sub" && track.id != null,
  );
  const selectedAudio = audioTracks.find((track) => track.selected);
  const selectedSubtitle = subtitleTracks.find((track) => track.selected);

  const VolumeIcon = snapshot.muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div className="border-t border-line-subtle px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-secondary">
          {formatTime(position)}
        </span>
        <Range
          label="Playback position"
          value={position}
          max={duration}
          disabled={!canControl || duration <= 0}
          onChange={setScrub}
          onCommit={commitScrub}
          className="flex-1"
        />
        <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-ink-secondary">
          {formatTime(duration)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ControlGroup>
          <IconButton
            label="Back 10 seconds"
            icon={<RotateCcw size={16} />}
            onClick={() => void bridge.seekBy(-10)}
            disabled={!canControl}
          />
          <Button
            size="sm"
            variant="secondary"
            className="w-[88px]"
            icon={
              snapshot.paused ? (
                <Play size={14} fill="currentColor" />
              ) : (
                <Pause size={14} fill="currentColor" />
              )
            }
            onClick={() => void bridge.togglePause()}
            disabled={!bridge.canPlay}
          >
            {snapshot.paused ? "Play" : "Pause"}
          </Button>
          <IconButton
            label="Forward 10 seconds"
            icon={<RotateCw size={16} />}
            onClick={() => void bridge.seekBy(10)}
            disabled={!canControl}
          />
        </ControlGroup>

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <ControlGroup>
          <IconButton
            label={snapshot.muted ? "Unmute" : "Mute"}
            icon={<VolumeIcon size={16} />}
            onClick={() => void bridge.toggleMute()}
            disabled={!canControl}
          />
          <Range
            label="Volume"
            value={volume}
            max={100}
            disabled={!canControl}
            onChange={setVolumeDraft}
            onCommit={commitVolume}
            className="w-[88px]"
          />
          <span className="w-8 shrink-0 font-mono text-[10px] tabular-nums text-ink-secondary">
            {Math.round(volume)}
          </span>
        </ControlGroup>

        <div className="ml-auto flex items-center gap-1.5">
          <Select
            aria-label="Playback speed"
            value={String(snapshot.speed)}
            onChange={(event) => void bridge.changeRate(Number(event.target.value))}
            disabled={!canControl}
            wrapperClassName="h-8 w-[82px] rounded-md"
            className="pl-2 pr-6 text-[11px]"
          >
            {speedOptions.map((rate) => (
              <option key={rate} value={rate}>
                {formatRate(rate)}
              </option>
            ))}
          </Select>

          {audioTracks.length > 1 ? (
            <Select
              aria-label="Audio track"
              value={String(selectedAudio?.id ?? audioTracks[0].id)}
              onChange={(event) =>
                void bridge.selectAudioTrack(Number(event.target.value))
              }
              disabled={!canControl}
              wrapperClassName="h-8 w-[116px] rounded-md"
              className="pl-2 pr-6 text-[11px]"
            >
              {audioTracks.map((track, index) => (
                <option key={track.id} value={String(track.id)}>
                  {track.title || track.language || `Audio ${index + 1}`}
                </option>
              ))}
            </Select>
          ) : null}

          {subtitleTracks.length > 0 ? (
            <Select
              aria-label="Subtitle track"
              value={
                bridge.subtitlesVisible && selectedSubtitle?.id != null
                  ? String(selectedSubtitle.id)
                  : "no"
              }
              onChange={(event) => {
                const value = event.target.value;
                void bridge.selectSubtitleTrack(
                  value === "no" ? "no" : Number(value),
                );
              }}
              disabled={!canControl}
              wrapperClassName="h-8 w-[124px] rounded-md"
              className="pl-2 pr-6 text-[11px]"
            >
              <option value="no">Subtitles off</option>
              {subtitleTracks.map((track, index) => (
                <option key={track.id} value={String(track.id)}>
                  {track.title || track.language || `Subtitle ${index + 1}`}
                </option>
              ))}
            </Select>
          ) : null}

          <IconButton
            label={bridge.subtitlesVisible ? "Hide subtitles" : "Show subtitles"}
            icon={
              bridge.subtitlesVisible ? (
                <Captions size={16} />
              ) : (
                <CaptionsOff size={16} />
              )
            }
            onClick={() => void bridge.toggleSubtitles()}
            disabled={!canControl}
          />

          <IconButton
            label="Fullscreen mpv"
            icon={<Maximize size={16} />}
            onClick={() => void bridge.toggleFullscreen()}
            disabled={!canControl}
          />
        </div>
      </div>
    </div>
  );
}
