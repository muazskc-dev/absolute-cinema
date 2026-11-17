import { useEffect, useState, type ReactNode } from "react";
import {
  Captions,
  ExternalLink,
  FlaskConical,
  Info,
  Palette,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Volume2,
  Wrench,
} from "lucide-react";

import {
  APP_NAME,
  APP_VERSION,
  GEIST_URL,
  MPV_URL,
  OWASP_PASSWORD_URL,
  REPO_URL,
  WCAG_URL,
  openExternal,
} from "../../lib/app-info";
import { isTauriRuntime, mpv } from "../../lib/mpv";
import type { SettingsSection } from "../../lib/rooms/types";
import {
  SPEED_OPTIONS,
  SUBTITLE_SCALES,
  useAppStore,
} from "../../stores/app-store";
import { PageContainer, PageHeader } from "../../components/layout/Page";
import { Button } from "../../components/ui/Button";
import { DemoBadge } from "../../components/ui/DemoBadge";
import { Range } from "../../components/ui/Range";
import { Select } from "../../components/ui/Select";
import { Separator } from "../../components/ui/Primitives";
import { Switch } from "../../components/ui/Switch";

const SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  icon: ReactNode;
}> = [
  { id: "general", label: "General", icon: <SlidersHorizontal size={14} /> },
  { id: "appearance", label: "Appearance", icon: <Palette size={14} /> },
  { id: "playback", label: "Playback", icon: <Play size={14} /> },
  { id: "audio", label: "Audio", icon: <Volume2 size={14} /> },
  { id: "subtitles", label: "Subtitles", icon: <Captions size={14} /> },
  { id: "privacy", label: "Privacy", icon: <ShieldCheck size={14} /> },
  { id: "rooms", label: "Rooms", icon: <Users size={14} /> },
  { id: "advanced", label: "Advanced", icon: <Wrench size={14} /> },
  { id: "about", label: "About", icon: <Info size={14} /> },
];

function SectionCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line-subtle bg-surface-1">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-medium text-ink">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-[60ch] text-[11px] leading-4 text-ink-secondary">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="px-5 py-1">{children}</div>
    </section>
  );
}

function SettingRow({
  title,
  description,
  children,
  icon,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line-subtle py-3.5 last:border-b-0">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 shrink-0 text-ink-secondary" aria-hidden>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-ink">{title}</p>
          {description ? (
            <p className="mt-0.5 max-w-[58ch] text-[11px] leading-4 text-ink-secondary">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function FixedValue({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-line bg-canvas px-2 py-1 font-mono text-[10px] text-ink-secondary">
      {children}
    </span>
  );
}

function VolumeControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Range
        label="Default volume"
        value={value}
        max={100}
        step={5}
        onChange={onChange}
        className="w-[140px]"
      />
      <span className="w-8 text-right font-mono text-[11px] tabular-nums text-ink-secondary">
        {value}
      </span>
    </div>
  );
}

export function SettingsScreen({ section }: { section?: SettingsSection }) {
  const { preferences, updatePreferences, openDialog, navigate } = useAppStore();
  const active: SettingsSection = section ?? "general";
  const [executable, setExecutable] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    void mpv
      .executable()
      .then((path) => {
        if (!disposed) setExecutable(path);
      })
      .catch(() => {
        if (!disposed) setExecutable(null);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const render = () => {
    switch (active) {
      case "general":
        return (
          <div className="flex flex-col gap-4">
            <SectionCard
              title="Interface"
              description="Local preferences are stored under a single key in this window's browser storage."
            >
              <SettingRow
                title="Reduce motion"
                description="Disable transitions and animation. The operating system preference is also honored."
              >
                <Switch
                  label="Reduce motion"
                  checked={preferences.reducedMotion}
                  onCheckedChange={(next) =>
                    updatePreferences({ reducedMotion: next })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Language"
                description="The Sprint 1 interface ships in English only."
              >
                <Select
                  aria-label="Interface language"
                  value="en"
                  disabled
                  wrapperClassName="h-8 w-[150px]"
                  className="text-[11px]"
                >
                  <option value="en">English</option>
                </Select>
              </SettingRow>
              <SettingRow
                title="Local data"
                description="Demo rooms, chat and passwords live in memory and reset when the app closes."
              >
                <FixedValue>In memory</FixedValue>
              </SettingRow>
            </SectionCard>
          </div>
        );

      case "appearance":
        return (
          <div className="flex flex-col gap-4">
            <SectionCard
              title="Theme"
              description="ABSOLUTE-CINEMA is deliberately monochrome. There is no accent color to configure."
            >
              <SettingRow
                title="Color system"
                description="Pure black, white and neutral grays. Status is never conveyed by color alone."
              >
                <FixedValue>Monochrome</FixedValue>
              </SettingRow>
              <SettingRow
                title="Typography"
                description="Geist and Geist Mono, bundled with the app under the SIL Open Font License."
              >
                <FixedValue>Geist</FixedValue>
              </SettingRow>
              <SettingRow
                title="Focus rings"
                description="A 2 px white outline with offset on every interactive element."
              >
                <FixedValue>Always on</FixedValue>
              </SettingRow>
            </SectionCard>

            <SectionCard
              title="Navigation"
              description="The sidebar is 224 px expanded and 64 px collapsed."
            >
              <SettingRow
                title="Collapse sidebar"
                description="Below 1180 px the sidebar collapses automatically and this preference is ignored."
              >
                <Switch
                  label="Collapse sidebar"
                  checked={preferences.sidebarCollapsed}
                  onCheckedChange={(next) =>
                    updatePreferences({ sidebarCollapsed: next })
                  }
                />
              </SettingRow>
            </SectionCard>
          </div>
        );

      case "playback":
        return (
          <div className="flex flex-col gap-4">
            <SectionCard
              title="Playback defaults"
              description="These values are applied when the mpv engine starts. They do not restart a running engine."
            >
              <SettingRow
                title="Default speed"
                description="Applied to a newly started engine."
              >
                <Select
                  aria-label="Default playback speed"
                  value={String(preferences.defaultSpeed)}
                  onChange={(event) =>
                    updatePreferences({
                      defaultSpeed: Number(event.target.value),
                    })
                  }
                  wrapperClassName="h-8 w-[110px]"
                  className="text-[11px]"
                >
                  {SPEED_OPTIONS.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}x
                    </option>
                  ))}
                </Select>
              </SettingRow>
              <SettingRow
                title="Source behavior"
                description="Each room participant plays a source on their own machine in Sprint 1."
              >
                <FixedValue>Local</FixedValue>
              </SettingRow>
            </SectionCard>

            <SectionCard title="Player surface">
              <SettingRow
                title="Video output"
                description="mpv renders in its own window. Embedded playback is gated future work."
              >
                <FixedValue>External mpv</FixedValue>
              </SettingRow>
              <SettingRow
                title="Developer lab"
                description="Start, stop and inspect the media engine outside a room."
              >
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<FlaskConical size={13} />}
                  onClick={() => navigate({ kind: "lab" })}
                >
                  Open lab
                </Button>
              </SettingRow>
            </SectionCard>
          </div>
        );

      case "audio":
        return (
          <div className="flex flex-col gap-4">
            <SectionCard
              title="Output"
              description="The default volume is applied when the engine starts. The current session volume is controlled from the room."
            >
              <SettingRow
                title="Output device"
                description="mpv uses the system default audio device."
              >
                <FixedValue>System default</FixedValue>
              </SettingRow>
              <SettingRow
                title="Default volume"
                description={`${preferences.defaultVolume}% on a new engine.`}
              >
                <VolumeControl
                  value={preferences.defaultVolume}
                  onChange={(next) =>
                    updatePreferences({ defaultVolume: next })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Volume controls"
                description="Up and Down arrows change the live volume by 5 when focus is not inside a field."
              >
                <FixedValue>↑ ↓ · M</FixedValue>
              </SettingRow>
            </SectionCard>

            <SectionCard
              title="Voice"
              description="Voice chat is not connected in Sprint 1. No microphone permission is requested."
            >
              <SettingRow
                title="Microphone"
                description="The prototype never opens a capture device."
              >
                <FixedValue>Off</FixedValue>
              </SettingRow>
              <SettingRow
                title="Transport"
                description="WebRTC with a coturn relay is planned; it is not part of this sprint."
              >
                <FixedValue>Not configured</FixedValue>
              </SettingRow>
            </SectionCard>
          </div>
        );

      case "subtitles":
        return (
          <div className="flex flex-col gap-4">
            <SectionCard
              title="Subtitles"
              description="Subtitle scale is applied to mpv when the engine starts. Track selection lives in the player deck."
            >
              <SettingRow
                title="Subtitle scale"
                description="Scales subtitle text rendered by mpv."
              >
                <Select
                  aria-label="Subtitle scale"
                  value={String(preferences.subtitleScale)}
                  onChange={(event) =>
                    updatePreferences({
                      subtitleScale: Number(event.target.value),
                    })
                  }
                  wrapperClassName="h-8 w-[110px]"
                  className="text-[11px]"
                >
                  {SUBTITLE_SCALES.map((scale) => (
                    <option key={scale} value={scale}>
                      {Math.round(scale * 100)}%
                    </option>
                  ))}
                </Select>
              </SettingRow>
              <SettingRow
                title="Visibility"
                description="Toggle subtitles from the player controls or the Captions button."
              >
                <FixedValue>mpv</FixedValue>
              </SettingRow>
            </SectionCard>
          </div>
        );

      case "privacy":
        return (
          <div className="flex flex-col gap-4">
            <SectionCard
              title="Local prototype"
              description="Sprint 1 has no account system, no analytics and no media upload."
            >
              <SettingRow
                title="Room passwords"
                description="Stored in memory only for the current window. Never written to disk. The future server stores an Argon2id hash."
              >
                <FixedValue>Memory only</FixedValue>
              </SettingRow>
              <SettingRow
                title="Media"
                description="Local paths and direct URLs are played by mpv on this machine. Video bytes never reach a server."
              >
                <FixedValue>Local</FixedValue>
              </SettingRow>
              <SettingRow
                title="Chat"
                description="Messages stay in renderer memory and disappear on close. No retention policy exists yet."
              >
                <FixedValue>In memory</FixedValue>
              </SettingRow>
              <SettingRow
                title="Telemetry"
                description="No application analytics are collected or sent."
              >
                <FixedValue>None</FixedValue>
              </SettingRow>
            </SectionCard>

            <SectionCard title="References">
              <SettingRow
                title="WCAG 2.2 contrast"
                description="The contrast targets used by this interface."
              >
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<ExternalLink size={13} />}
                  onClick={() => void openExternal(WCAG_URL)}
                >
                  Open
                </Button>
              </SettingRow>
              <SettingRow
                title="Password storage"
                description="OWASP guidance for the planned Argon2id implementation."
              >
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<ExternalLink size={13} />}
                  onClick={() => void openExternal(OWASP_PASSWORD_URL)}
                >
                  Open
                </Button>
              </SettingRow>
            </SectionCard>
          </div>
        );

      case "rooms":
        return (
          <div className="flex flex-col gap-4">
            <SectionCard
              title="Room defaults"
              description="Applied to new rooms and to the history view."
            >
              <SettingRow
                title="Password protection by default"
                description="New rooms start with the password switch enabled. Passwords require at least 12 characters."
              >
                <Switch
                  label="Password protection by default"
                  checked={preferences.defaultPasswordProtection}
                  onCheckedChange={(next) =>
                    updatePreferences({ defaultPasswordProtection: next })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Copy invitation after creating"
                description="Copies the demo invitation link to the clipboard."
              >
                <Switch
                  label="Copy invitation after creating"
                  checked={preferences.copyInvitationOnCreate}
                  onCheckedChange={(next) =>
                    updatePreferences({ copyInvitationOnCreate: next })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Show archived rooms"
                description="Archived rooms remain recoverable and are hidden by default."
              >
                <Switch
                  label="Show archived rooms"
                  checked={preferences.showArchivedByDefault}
                  onCheckedChange={(next) =>
                    updatePreferences({ showArchivedByDefault: next })
                  }
                />
              </SettingRow>
            </SectionCard>

            <SectionCard
              title="Lifecycle"
              description="Dormant rooms are persistent records, not deleted sessions."
            >
              <SettingRow
                title="States"
                description="Dormant, waking, waiting, live and reconnecting are local prototype transitions in Sprint 1."
              >
                <FixedValue>5 states</FixedValue>
              </SettingRow>
            </SectionCard>
          </div>
        );

      case "advanced":
        return (
          <div className="flex flex-col gap-4">
            <SectionCard
              title="Media engine"
              description="mpv is a separate process controlled over a Windows named-pipe JSON IPC bridge."
            >
              <SettingRow
                title="Executable"
                description="Detected from the configured path or the system installation."
              >
                <span
                  className="max-w-[280px] truncate font-mono text-[10px] text-ink-secondary"
                  title={executable ?? "Not detected"}
                >
                  {executable ?? "Not detected"}
                </span>
              </SettingRow>
              <SettingRow
                title="Playback defaults"
                description="Volume, speed and subtitle scale are applied at engine start."
              >
                <FixedValue>Applied on start</FixedValue>
              </SettingRow>
            </SectionCard>

            <SectionCard
              title="Preferences"
              description="Reset the local preference key. Rooms, chat and passwords are held separately in memory."
              actions={
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<RotateCcw size={13} />}
                  onClick={() => openDialog({ kind: "reset-preferences" })}
                >
                  Reset
                </Button>
              }
            >
              <SettingRow
                title="Storage key"
                description="A single JSON object in this window's browser storage."
              >
                <FixedValue>ac.preferences.v1</FixedValue>
              </SettingRow>
              <SettingRow
                title="Developer lab"
                description="Diagnostics, IPC events and the Sprint 0 media proof."
              >
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<FlaskConical size={13} />}
                  onClick={() => navigate({ kind: "lab" })}
                >
                  Open lab
                </Button>
              </SettingRow>
            </SectionCard>
          </div>
        );

      case "about":
        return (
          <div className="flex flex-col gap-4">
            <SectionCard title="ABSOLUTE-CINEMA">
              <SettingRow
                title="Version"
                description="Sprint 1 · premium interface and room experience."
              >
                <FixedValue>{APP_VERSION}</FixedValue>
              </SettingRow>
              <SettingRow
                title="Repository"
                description="Source, sprint reports and design documents."
              >
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<ExternalLink size={13} />}
                  onClick={() => void openExternal(REPO_URL)}
                >
                  GitHub
                </Button>
              </SettingRow>
              <SettingRow
                title="Stack"
                description="Tauri 2 · React 19 · TypeScript · Tailwind 4 · mpv."
              >
                <FixedValue>Desktop</FixedValue>
              </SettingRow>
              <SettingRow
                title="Typeface"
                description="Geist and Geist Mono are bundled under the SIL Open Font License 1.1."
              >
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<ExternalLink size={13} />}
                  onClick={() => void openExternal(GEIST_URL)}
                >
                  Vercel
                </Button>
              </SettingRow>
              <SettingRow
                title="Media engine"
                description="mpv is licensed under GPLv2 or later. Distribution compliance is an open decision."
              >
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<ExternalLink size={13} />}
                  onClick={() => void openExternal(MPV_URL)}
                >
                  mpv.io
                </Button>
              </SettingRow>
            </SectionCard>

            <section className="rounded-xl border border-line-subtle bg-surface-1 p-5">
              <h2 className="text-[14px] font-medium text-ink">
                What Sprint 1 is
              </h2>
              <p className="mt-2 text-[12px] leading-5 text-ink-secondary">
                A complete monochrome interface, a local room lifecycle demo and
                a preserved Sprint 0 media engine. It is not a synchronized
                product yet: no backend, no account system, no WebRTC and no
                embedded video.
              </p>
              <Separator className="my-4" />
              <p className="text-[11px] leading-4 text-ink-secondary">
                {APP_NAME} is a private two-person cinema. This build is a
                prototype.
              </p>
            </section>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <PageContainer wide>
      <PageHeader
        title="Settings"
        description="Preferences, playback defaults and the honest state of the prototype."
        actions={<DemoBadge label="Local settings" />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[176px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="min-w-0">
          <div className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {SECTIONS.map((entry) => {
              const selected = entry.id === active;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() =>
                    navigate({ kind: "settings", section: entry.id })
                  }
                  className={
                    selected
                      ? "flex h-8 items-center gap-2 rounded-md bg-surface-2 px-2.5 text-left text-[12px] text-ink"
                      : "flex h-8 items-center gap-2 rounded-md px-2.5 text-left text-[12px] text-ink-secondary transition-colors duration-100 hover:bg-surface-1 hover:text-ink"
                  }
                >
                  <span className="grid size-4 place-items-center" aria-hidden>
                    {entry.icon}
                  </span>
                  <span className="truncate">{entry.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0">{render()}</div>
      </div>

      <p className="mt-6 flex items-center gap-2 border-t border-line-subtle pt-4 text-[11px] text-ink-secondary">
        <Settings2 size={12} aria-hidden />
        Preferences are local to this installation. Transcripts, accounts and
        server policy do not exist yet.
      </p>
    </PageContainer>
  );
}
