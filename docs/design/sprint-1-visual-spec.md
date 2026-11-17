# ABSOLUTE-CINEMA — Sprint 1 Visual Specification

**Status:** implementation specification for Sprint 1.
**Scope:** Windows desktop client UI, monochrome design system, room
experience prototypes.
**Not in scope:** backend persistence, cross-device rooms, WebRTC voice,
shared playback synchronization. Those remain later-sprint work and are marked
as such throughout this document.

---

## 1. Product visual identity

ABSOLUTE-CINEMA is a private cinema for exactly two people. The interface
should feel like a quiet, precision-built desktop tool that gets out of the way
of the film.

Three influences, no copying:

| Influence | What we take | What we do not take |
|---|---|---|
| Apple | Restraint, hierarchy, negative space, deliberate states | macOS chrome, traffic lights, Apple assets |
| Vercel Geist | Monochrome surfaces, precise alignment, compact type, functional density | Vercel branding, marketing layouts |
| ChatGPT | Calm sidebar, focused workspace, simple conversation patterns | ChatGPT's exact layout or identity |

The product must read as a Windows application. Native title bar and window
behavior stay intact. The brand expression lives in typography, proportion and
interaction quality, not decoration.

**Voice of the interface:** factual, short, calm. No slogans repeated inside
product screens. No exclamation marks. No fake activity.

---

## 2. Design references

- Apple Human Interface Guidelines — hierarchy, feedback, restraint.
- Geist design system — https://vercel.com/geist
- Geist typography — https://vercel.com/geist/typography
- Geist font — https://vercel.com/font (SIL OFL 1.1)
- Lucide icons — https://lucide.dev
- WCAG 2.2 contrast minimum — https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum
- OWASP password storage — https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

References are principles and public design knowledge. No proprietary assets,
screenshots, illustrations or brand marks are copied.

---

## 3. Color tokens

The product is strictly monochrome. There is no accent hue in Sprint 1.
The values below ship as Tailwind 4 `@theme` tokens in
`apps/desktop/src/styles.css`.

```css
@theme {
  --color-canvas: #000000;
  --color-sidebar: #050505;

  --color-surface-1: #0a0a0a;
  --color-surface-2: #111111;
  --color-surface-3: #191919;

  --color-line: #262626;
  --color-line-subtle: #1a1a1a;

  --color-ink: #f5f5f5;
  --color-ink-secondary: #a1a1aa;
  --color-ink-muted: #777777;

  --color-focus: #ffffff;
}
```

Semantic mapping:

| Role | Token | Notes |
|---|---|---|
| App canvas | `--color-canvas` | True black; OLED pixels off |
| Sidebar | `--color-sidebar` | One step above canvas |
| Panels / rows | `--color-surface-1` | Resting cards, list hover base |
| Menus / dialogs | `--color-surface-2` | Elevated without glow |
| Active control surface | `--color-surface-3` | Pressed / selected |
| Dividers | `--color-line` | 1 px |
| Quiet dividers | `--color-line-subtle` | Inside dense lists |
| Primary text | `--color-ink` | 19.1:1 on black |
| Secondary text | `--color-ink-secondary` | 8.2:1 on black, 7.4:1 on `#111` |
| Muted text | `--color-ink-muted` | 4.7:1 on black; do not use on raised panels |
| Focus ring | `--color-focus` | 2 px, 2 px offset |

**Contrast policy.** `#777777` on `#0a0a0a` is ~4.4:1, below AA for normal
text. Muted text is therefore restricted to the true black canvas and sidebar.
On panels, metadata uses `#a1a1aa`. Status is never communicated by color alone:
icon + text + shape always carry the meaning.

There are no red/green/blue/amber status colors, no colored badges, no glow.

---

## 4. Typography scale

Fonts are bundled locally through Fontsource:

- **Geist Variable** — UI, headings, body.
- **Geist Mono Variable** — timecodes, codecs, PIDs, resolutions, IDs.

Both are SIL OFL 1.1. License files ship with the packages; attribution appears
in Settings → About and in the repository documentation.

| Role | Size | Weight | Line height | Tracking |
|---|---:|---:|---:|---:|
| Display / page heading | 26 px | 550 | 1.2 | -0.02em |
| Page title | 22 px | 550 | 1.25 | -0.015em |
| Section heading | 16 px | 550 | 1.35 | -0.01em |
| Subsection | 14 px | 550 | 1.4 | 0 |
| Body | 14 px | 400 | 1.55 | 0 |
| Secondary | 13 px | 400 | 1.5 | 0 |
| Metadata | 12 px | 400 | 1.4 | 0.005em |
| Technical value | 12 px | 400 mono | 1.4 | 0 |
| Eyebrow label | 10–11 px | 500 | 1.2 | 0.14em uppercase |

Implementation uses only these steps: **10, 11, 12, 13, 14, 16, 22, 26 px**.
No 9, 15 or 20 px values ship in the interface.

Rules:

- No font weight below 400 in UI copy.
- No oversized section headings; hierarchy comes from size, spacing and
  contrast, not from shouting.
- Numeric values use tabular mono where alignment matters.
- Long paths and IDs truncate with a tooltip rather than wrapping into layout.

---

## 5. Golden-ratio composition

φ = 1.6180339887. Used as a composition guide, never as visible decoration.

| Composition | Ratio |
|---|---|
| Main workspace / secondary rail | 61.8% / 38.2% |
| Sidebar / workspace at wide widths | ~224 px / remaining |
| Player / chat drawer (when open) | 1fr / 336 px overlay |
| Waiting room: invite panel / presence panel | 1.618fr / 1fr |
| Home: active rooms / recent rooms | 1.618fr / 1fr |

Constraints:

- Ratios break cleanly below 1180 px; secondary columns stack instead of
  compressing text. The golden-ratio grids switch to a single column at
  `min-[1180px]`, matching the responsive rule in section 19.
- The main content column caps at ~1000 px and centers inside the workspace.
- The player keeps 16:9 and never sacrifices controls for decoration.
- No golden-ratio overlays, spirals, or mathematical ornament.

---

## 6. Spacing system

Base scale: **4, 8, 12, 16, 24, 32, 48, 64**.

| Context | Value |
|---|---|
| Icon ↔ label | 8 px |
| Control inner horizontal padding | 12–16 px |
| Inline control gap | 8 px |
| Group gap | 12 px |
| Section gap | 24 px |
| Page block gap | 32 px |
| Page outer padding | 32 px wide, 24 px at 1100 px |
| Sidebar row height | 36 px |
| Room row height | 72 px (56 px compact recent row) |
| Header height | 52 px |
| Dialog padding | 24 px |
| Dialog width | 440 px (400–460 allowed) |

Vertical rhythm is enforced by these values; no arbitrary 7/13/19 px gaps.

---

## 7. Sidebar structure

```
+ New room

HOME
  Home
  Active rooms
  Room history

RECENT ROOMS
  Friday Cinema
  Weekend Movie
  Private Cinema
  Show all

Settings
Developer lab
Profile
```

- Width 224 px expanded, 64 px collapsed.
- Collapse control is a full-width `Collapse sidebar` row with a `Ctrl B`
  hint; the collapsed state exposes a 32 px expand icon button.
- Selected item: `surface-2` fill, primary text, 2 px inset left indicator.
- Hover: `surface-1`, 100 ms.
- Recent rooms show a 6 px status dot (outline = dormant, filled = live) and a
  lock icon when protected. No colorful icons.
- Recent rooms derive from every non-archived room, sorted by `lastActiveAt`.
- Show at most four recent rooms; "Show all" goes to Room History.
- Profile is a disabled placeholder with a `Local` badge until accounts exist.
- Under 1180 px the sidebar is forced to 64 px; labels move to tooltips.
- Keyboard: Tab reaches every item; focus ring is visible; `Ctrl+B` toggles
  collapse when focus is not inside an input.

---

## 8. Home screen

**Header**

- `Your cinema` (26 px / 550)
- `Your private spaces, ready when you are.` (13 px secondary)

**Primary actions**

The page header carries `Join room` (outlined) and `Create room` (white fill,
38 px) on the right. There is no separate action bar.

**Layout**

```
[ page header: title + description        Join room   Create room ]

+---------------------------+  +----------------------+
| Active now (61.8%)        |  | Recent rooms (38.2%) |
| live / waiting rows       |  | compact rows         |
+---------------------------+  +----------------------+
```

- The golden-ratio split applies at `min-[1180px]`; below that both sections
  stack.
- Active rooms are above history everywhere in the product.
- Each active row: name, partner, status, count, lock, Open, overflow menu.
- Recent rows: name, last active, status, Wake/Open, overflow menu.
- Row actions stay visible at all times. This deliberately diverges from a
  hover-only design so keyboard and touch users can discover them.
- Empty active state: `No one is in a room right now.` + Join a room.
- Empty history state: `No rooms in your history yet.` + Create room.
- No fake metrics, no charts, no marketing hero.

---

## 9. Room History specification

First-class screen, not a settings table.

**Header:** `Room history` / `Your previous cinema spaces.`

**Toolbar:** search (name or partner), status filter, sort by last activity
(default) or name, protected-only switch, show-archived switch.

**List columns:** Room (name, partner, lock), Status, Last active, Access
action, overflow menu. Rows are 72 px, separated by 1 px `--color-line-subtle`.

Dormant row:

- Moon icon, `Dormant` label, neutral text.
- Fully readable; no red warning, no disabled opacity.
- `Wake` and the overflow menu stay visible at all times. Hover is not required
  to reveal actions; this is a documented accessibility divergence.

Archived rows appear only when the archived filter is on and carry an
`Archived` label. Deleting requires a confirmation dialog.

---

## 10. Dormant and active state specification

| State | Icon | Label | Meaning |
|---|---|---|---|
| Dormant | Moon | `Dormant` | Persistent record; no runtime |
| Waking | Loader | `Waking…` | Server/runtime activation in progress |
| Waiting | Clock | `Waiting · 1/2` | One participant connected |
| Live | Signal | `Live · 2/2` | Both participants connected |
| Reconnecting | Rotate | `Reconnecting…` | Grace window active |
| Archived | Archive | `Archived` | Recoverable, hidden by default |

All labels use icon + text. No color-only status. Waking uses a small loader
icon; the spin is disabled by reduced motion, and text carries the state on its
own.

Dormant is explicitly not deleted. Copy: `Dormant rooms stay in your history
and can be woken at any time.`

In Sprint 1, waking is a local 900 ms prototype transition. It does not contact
a server.

---

## 11. Create Room specification

Dialog width 440 px.

Fields:

- Room name (required, 2–48 characters).
- Participants: read-only `2 people maximum`.
- Password protection switch (default from Room Preferences).
- Password + confirm (12+ characters), show/hide controls.
- Privacy note: `Only the two invited participants can enter. Passwords are
  never stored in this prototype.`
- Primary action `Create room`, secondary `Cancel`.

Validation appears inline, 12 px secondary text with an alert icon; no red.
Password rules: minimum 12 characters for new passwords, confirm must match.
No strength meter with colored bars.

After creation (local prototype): the room is added with status `waiting`,
`1/2`, an `AC-XXXX` demo invitation code, and the app opens the Waiting Room.
No server ID is invented or presented as real.

---

## 12. Password protection specification

- Password is optional per room.
- Never display an existing password.
- Owner actions: set, change, remove, copy invitation.
- Demo passwords exist only in memory and are labeled development data.
- Sprint 1 does not verify passwords on a server; the UI explicitly says
  `Sprint 1 checks the password in this window only.`
- Future backend: Argon2id, per-password salt, ≥19 MiB memory, ≥2 iterations,
  parallelism 1; rate-limited attempts; no plaintext logging; no passwords in
  invitation URLs; no hashes in API responses; TLS only.
- Forgetting a password means replacing it; recovery is impossible.

---

## 13. Join Room specification

Dialog width 440 px.

Flow:

1. Input accepts an invitation code (`AC-XXXX`) or an `absolute-cinema://join/…`
   link. A paste button reads the clipboard when the platform allows it.
2. `Continue` resolves locally (300 ms simulated delay) with a loading state.
3. Preview: room name, participant count, lock state, status.
4. Password-protected rooms ask for the password; wrong password shows
   `Unable to join. Check the invitation and password.`
5. Full rooms show `This room already has two participants.`
6. Unknown codes show `This room is currently unavailable.`
7. Archived rooms show `This room is archived. Restore it from Room history first.`
8. Success opens the room as a local prototype.

Demo codes are listed inside the dialog as development data: `AC-WAIT`
(waiting 1/2), `AC-7F2K` (dormant, password `cinema-night`), `AC-FULL`
(live 2/2). The local seed also contains `AC-RECN`, `AC-SUN1` and `AC-NY24`
for reconnecting, dormant and archived history states; they are not advertised
in the join dialog.

No request is sent to a server. No URL is fetched.

---

## 14. Waiting Room specification

Composition 1.618 : 1 at `min-[1180px]`; stacked below that.

**Room header** (shared with Cinema Room):

- Back control, room name (22 px), lock, status, invitation code.
- `Chat`, `Voice`, `Invite` and the room overflow menu.
- A `Demo room · local only` label.

**Left panel:**

- Status label and `Prototype` badge.
- `Waiting for the other participant` (22 px) or `Waking the room runtime`.
- A short explanation that the room exists and needs a second participant.
- While waking: a static lifecycle strip (`DORMANT → WAKING → WAITING`) and a
  note that no server request is sent.
- Invitation link in mono + Copy.
- Primary `Simulate partner joining`, secondary `Open chat`.
- A labeled notice that the transition is renderer-only.
- A three-step strip: send the invitation, they join, the cinema opens.

**Right rail:**

- Room details: status, participants, access, invitation, created, last active,
  message count.
- Local lifecycle: `Partner joins → Live`, `End room → Dormant`.
- Password note: checked in memory for this prototype; the future server
  verifies an Argon2id hash and rate-limits attempts.

No confetti, flashing, large spinners, or decorative illustrations. Waking uses
a small loader whose spin stops under reduced motion.

---

## 15. Cinema Player specification

Layout: room header → player surface (16:9, black) → controls panel. A secondary
rail holds session state and real playback telemetry. The main/rail split is
1.618 : 1 at `min-[1180px]`.

**Honesty requirement:** mpv renders in its own process window. The React
surface never pretends to contain decoded video. It states:

`mpv is rendering in a separate window.`
`Embedded video is a separately gated engineering task.`

The surface shows real metadata only: title, resolution, codec, `hwdec`,
frame drops. If no media is loaded, it shows an empty state with local-file and
URL actions.

Controls (all wired to the existing IPC bridge where possible):

- Play / pause.
- Seek bar with current and total time (mono).
- Back 10 s / forward 10 s.
- Volume slider + mute.
- Speed menu (0.5–2.0).
- Audio track selector when more than one audio track exists.
- Subtitle selector with `Subtitles off` when subtitle tracks exist.
- Captions toggle for subtitle visibility.
- Fullscreen video (sets mpv `fullscreen`).
- `Details` disclosure in the Playback rail for PID, frame drops, pixel format,
  hardware pixel format and audio codec.
- No quality menu for resolutions the source does not provide.

Keyboard: Space, ←/→ (5 s), Shift+←/→ (30 s), ↑/↓ volume, M, F, C. Esc closes
the chat drawer or the open dialog. Shortcuts are ignored while typing in
inputs, textareas, selects or contenteditable fields, and while a dialog is
open.

---

## 16. Chat Drawer specification

- 336 px wide, overlay on the right; player geometry does not change.
- Header: `Chat`, `Local to this window`, close button.
- Message rows: sender (11 px 550), timestamp (10 px mono secondary), body
  (12 px), separated by subtle rules. There are no bubbles, no surface fills and
  no avatars.
- No emoji picker. Platform emoji introduce color and inconsistent glyphs, so
  the monochrome composer stays text-only. This is a documented divergence from
  the earlier sketch.
- Composer: textarea, character cap, send button. Enter sends, Shift+Enter
  inserts a newline. Messages are capped at 2000 characters.
- A message count and `Clear` action sit above the list.
- Messages persist in the app store per room; closing the drawer does not clear
  them. The drawer stays mounted, so scroll position survives closing.
- Empty state: `No messages yet` with a short local-only explanation.
- Drawer motion: 180 ms transform, cubic-bezier(0.23, 1, 0.32, 1); reduced
  motion makes it instant.
- Clearly labeled as local prototype; no delivery receipts, no presence claims.

---

## 17. Settings specification

Two-pane layout: section nav (176 px) + content. Below the `lg` breakpoint
(1024 px) the nav becomes a horizontally wrapping row.

Sections and honesty:

| Section | Sprint 1 behavior |
|---|---|
| General | Reduce-motion switch, read-only English language, in-memory data note |
| Appearance | Fixed monochrome theme, Geist note, focus-ring note, sidebar collapse |
| Playback | Default speed applied at engine start; local source note; lab link |
| Audio | System-default output, default volume, shortcut hint, mic off, transport not configured |
| Subtitles | Scale persists and applies at engine start; visibility controlled by mpv |
| Privacy | Passwords memory-only, local media, chat memory, no telemetry, references |
| Rooms | Default password protection, copy-on-create, archived default, lifecycle note |
| Advanced | Detected mpv path, defaults applied on start, reset preferences, lab link |
| About | Version, repository, stack, typeface, mpv license, honest Sprint 1 scope |

Rules:

- No switch that implies unavailable behavior. Future features are rows with
  explanatory text, not fake toggles.
- Preferences live in `localStorage` under `ac.preferences.v1`; never room
  passwords.
- Reset requires confirmation and reports the result.

---

## 18. Developer Lab navigation

- Sidebar footer item `Developer lab`, also reachable from Settings → Advanced.
- Contains the preserved Sprint 0 Media Lab: engine start/stop/restart, local
  file, direct URL, transport, rate, audio/subtitle selectors, telemetry, event
  stream and `Copy diagnostics`.
- Reskinned to the monochrome system; no red/amber/emerald states.
- Status uses icon + label. The mpv path, PID, decoder and drop counters remain
  visible.
- A persistent note states that the lab is a diagnostic surface, not the
  product's primary flow. A second note states that media never leaves the
  machine and embedded video is future work.

---

## 19. Responsive rules

Supported window sizes: 1920×1080, 1280×768, 1100×720. Native display scaling:
100%, 125%, 150% (Tauri logical units keep layout stable).

| Condition | Behavior |
|---|---|
| ≥1180 px | Sidebar 224 px, golden-ratio two-column compositions |
| <1180 px | Sidebar forced to 64 px, home/room rails stack |
| <900 px | Chat becomes a full-width overlay drawer; dialogs cap at viewport − 48 px |
| Any | No horizontal page scrolling; long identifiers truncate |

Minimum window 1100×720 is preserved. Dialogs must fit with 24 px vertical
margin. Text must not clip at 125% scaling.

---

## 20. Accessibility requirements

- WCAG 2.2 AA contrast for all text; verified combinations are documented in
  section 3.
- Visible `:focus-visible` ring on every interactive element.
- All icon-only buttons have `aria-label` and a tooltip.
- Dialogs: `role="dialog"`, `aria-modal`, labelled title, focus trap, Escape,
  focus restoration.
- Drawers: non-modal. Escape closes, focus moves into the composer, focus
  returns to the trigger, and the background stays reachable.
- Tab order follows visual order; no positive `tabindex`.
- Status is icon + text, never color alone.
- Keyboard shortcuts never fire inside editable fields or open dialogs.
- Reduced motion is respected via media query and an explicit preference.
- Hit targets: 32 px minimum for icon buttons, 36–40 px for standard controls.

---

## 21. Anti-AI-slop checklist

Before shipping any screen, all answers must be "no":

- [ ] Decorative AI image, stock photo, poster, or theater scene?
- [ ] Purple/blue/neon gradient, glow, or glassmorphism?
- [ ] Fake activity chart, metric, notification, or avatar?
- [ ] Emoji in navigation?
- [ ] Card grid used only to fill space?
- [ ] Oversized icon or heading without hierarchy reason?
- [ ] Marketing slogan repeated inside the product?
- [ ] Color used as the only status signal?
- [ ] Shadow heavier than the surface hierarchy needs?
- [ ] Element with no user purpose?

Quality must come from type, alignment, spacing, surface contrast, borders,
control states and interaction timing.

---

## 22. Component inventory

```
components/ui/
  Button, IconButton, Input, PasswordInput, Select, Switch, Range
  Field, Dialog, Drawer, Popover, Tooltip, ContextMenu, Toast
  EmptyState, Notice, DemoBadge, StatusLabel
  Primitives (Separator, Kbd)

components/layout/
  AppShell, AppHeader, Sidebar, DialogHost
  Page (PageContainer, PageHeader, SectionHeader)

components/room/
  RoomRow, RoomStatus, RoomHeader, ParticipantIndicator
  RoomActionMenu, InviteLink

components/
  DiagnosticsPanel, EventStream

features/
  home/HomeScreen
  rooms/ActiveRoomsScreen, CreateRoomDialog, JoinRoomDialog, RoomScreen,
        WaitingRoom, RenameRoomDialog, RoomPasswordDialog, DeleteRoomDialog,
        ResetPreferencesDialog
  player/CinemaRoom, PlayerSurface, PlayerControls, SourceBar
  chat/ChatDrawer
  voice/VoicePanel
  history/RoomHistoryScreen
  settings/SettingsScreen
  lab/MediaLab (preserved and reskinned)

hooks/
  use-mpv-bridge, use-dialog-focus, use-media-query

stores/
  app-store (view, rooms, preferences, dialogs, toasts, chat)

lib/
  rooms (types, seed, invite), format, clipboard, cn, app-info, mpv
```

Track selection uses plain `Select` controls; there is no separate `TrackMenu`.
The chat composer uses a native `textarea`; there is no `Textarea` component.
There is no `Skeleton` component; the only skeleton is the CSS progress strip
inside the waking state. No component is created without a screen that uses it.

---

## 23. Interaction specifications

| Interaction | Duration | Easing |
|---|---:|---|
| Hover surface / text | 100 ms | ease-out |
| Press scale (0.98) | 100 ms | ease-out |
| Dialog enter and exit | 160 ms | cubic-bezier(0.23, 1, 0.32, 1) |
| Sidebar width | 150 ms | ease-out |
| Chat drawer | 180 ms | cubic-bezier(0.23, 1, 0.32, 1) |
| Toast enter/exit | 180 ms | ease-out |

- Enter from `opacity: 0, scale(0.985)`, never `scale(0)`.
- Hover animations only under `(hover: hover) and (pointer: fine)`.
- No continuous decorative animation. Small spinners appear only while an
  operation is pending, and reduced motion freezes them. The explicit
  `reducedMotion` preference sets `data-reduced-motion` on the document and
  feeds `MotionConfig`; the OS media query is honored independently.
- No per-frame React state updates for the player; telemetry stays at 4 Hz.

---

## 24. Sprint 1 acceptance criteria

- [x] Monochrome identity consistent across every screen.
- [x] Geist Sans/Mono bundled locally with license attribution.
- [x] Golden-ratio compositions used on Home, Waiting Room, Cinema Room.
- [x] No decorative imagery, gradients, glows, or colored status.
- [x] Sidebar expands/collapses and survives narrow windows.
- [x] Home, Active Rooms, Room History work with labeled demo data.
- [x] Create Room, Join Room, password states, Waiting Room work locally.
- [x] Dormant rooms are readable and wakeable; history persists in state.
- [x] Cinema Room exposes the real mpv bridge and states its window limitation.
- [x] Chat drawer opens/closes and preserves local messages.
- [x] Settings navigation works; functional preferences persist locally.
- [x] Developer Lab preserves Sprint 0 media functionality.
- [x] Dialogs fit 1280×768 and 1100×720; no clipped text.
- [x] Keyboard shortcuts and dialog focus behavior work.
- [x] `pnpm typecheck`, Rust fmt, Clippy `-D warnings`, Rust tests, media smoke
      tests pass.
- [x] Screenshots captured from the running Tauri app, not mockups.
- [x] Sprint 1 report states exactly what is real and what is prototype.

---

## What is real in Sprint 1

- All UI, navigation, design tokens, component system.
- Local room state, wake/create/join/password/chat prototypes.
- The existing mpv engine and IPC bridge, unchanged.
- Local preferences.
- Real screenshots and test evidence.

## What remains prototype or future

- Room persistence across launches or devices.
- Server-side authorization, passwords, Argon2id, rate limiting.
- Cross-device invitations and real invitation tokens.
- Shared playback timeline and synchronization.
- WebRTC voice and microphone permission flow.
- Embedded video inside the Tauri window.

These are labeled in the UI where they could otherwise mislead.
