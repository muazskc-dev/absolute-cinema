import { useState, type FormEvent } from "react";
import {
  CircleStop,
  FolderOpen,
  Link2,
  Loader2,
  Power,
  RotateCcw,
} from "lucide-react";

import type { MpvBridge } from "../../hooks/use-mpv-bridge";
import { Button } from "../../components/ui/Button";

export function SourceBar({ bridge }: { bridge: MpvBridge }) {
  const [url, setUrl] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const busy = bridge.busy !== null;

  const loadUrl = (event?: FormEvent) => {
    event?.preventDefault();
    const target = url.trim();
    if (!/^https?:\/\//i.test(target)) {
      setInputError("Enter a direct http:// or https:// media URL.");
      return;
    }
    setInputError(null);
    void bridge.openTarget(target);
  };

  return (
    <div className="rounded-xl border border-line-subtle bg-surface-1 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {bridge.snapshot.running ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={
                busy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FolderOpen size={14} />
                )
              }
              onClick={() => void bridge.openFile()}
              disabled={busy}
            >
              Open local file
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<CircleStop size={14} />}
              onClick={() => void bridge.stopEngine()}
              disabled={busy}
            >
              Stop engine
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw size={14} />}
              onClick={() => void bridge.restartEngine()}
              disabled={busy}
            >
              Restart
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            icon={
              busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Power size={14} />
              )
            }
            onClick={() => void bridge.startEngine()}
            disabled={busy}
          >
            Start engine
          </Button>
        )}

        <form onSubmit={loadUrl} className="flex min-w-[240px] flex-1 items-center gap-2">
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 focus-within:ring-2 focus-within:ring-white/90 focus-within:ring-offset-2 focus-within:ring-offset-canvas">
            <Link2 size={13} className="shrink-0 text-ink-secondary" aria-hidden />
            <input
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setInputError(null);
              }}
              aria-label="Direct media URL"
              placeholder="https://example.com/movie.mp4"
              spellCheck={false}
              disabled={!bridge.tauri}
              className="h-full min-w-0 flex-1 bg-transparent font-mono text-[11px] text-ink outline-none placeholder:text-ink-secondary disabled:cursor-not-allowed"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!bridge.tauri || busy || !url.trim()}
          >
            Load URL
          </Button>
        </form>
      </div>

      {inputError ? (
        <p role="alert" className="mt-2 text-[11px] leading-4 text-ink">
          {inputError}
        </p>
      ) : null}

      <p className="mt-2 text-[11px] leading-4 text-ink-secondary">
        Sprint 1 plays a source on this machine only. Per-room synchronized
        playback is future server work.
      </p>
    </div>
  );
}
