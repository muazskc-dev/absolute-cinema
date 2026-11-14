# Protocol

Version: 1 (MVP). Canonical implementation lives in `packages/protocol` (Zod
schemas) and `services/api/src/timeline` (pure math). This document is the
human-readable contract; where they disagree, the Zod schemas and their tests
win, and this document is fixed.

## 1. Transport

- REST: HTTPS, JSON, `Authorization: Bearer <deviceToken>`.
- Realtime: WSS, one connection per client, UTF-8 JSON text frames.
- Encoding: camelCase on the wire. Seconds are floats; times are epoch
  milliseconds (integer).
- Maximum WS frame: 64 KiB. Chat messages: 2,000 characters.
- Every message has a protocol version. Unknown versions or event types are
  rejected, not ignored.

Envelope:

```json
{
  "v": 1,
  "event": "playback.intent",
  "requestId": "c_01J...",
  "data": { }
}
```

Server messages add `serverTime` (epoch ms) and may echo `requestId`:

```json
{
  "v": 1,
  "event": "playback.state",
  "requestId": "c_01J...",
  "serverTime": 1731600000123,
  "data": { }
}
```

Errors:

```json
{
  "v": 1,
  "event": "error",
  "serverTime": 1731600000123,
  "data": {
    "code": "stale_revision",
    "message": "The timeline moved. Apply the latest state.",
    "retryable": false,
    "details": { "currentRevision": 43 }
  }
}
```

## 2. REST API

Base path `/v1`. All responses `application/json`. All timestamps are ISO-8601
strings in REST and epoch ms on the WS.

### POST /auth/guest

Creates or resumes a device identity. Rate limited per IP.

```json
{ "displayName": "Ada" }
```

```json
{
  "userId": "usr_01J...",
  "displayName": "Ada",
  "deviceToken": "acd_...",
  "createdAt": "2026-11-14T20:00:00.000Z"
}
```

`deviceToken` is shown once; the client stores it in Windows Credential
Manager. The server stores only its SHA-256 hash. No password exists in the
MVP.

### POST /auth/ws-ticket

Bearer device token. Returns a single-use, 60-second ticket.

```json
{ "ticket": "wst_...", "expiresAt": "2026-11-14T20:01:00.000Z" }
```

### POST /rooms

```json
{
  "name": "Friday night",
  "keepInSync": true,
  "media": null
}
```

```json
{
  "room": {
    "id": "rm_01J...",
    "name": "Friday night",
    "status": "waiting",
    "hostId": "usr_01J...",
    "keepInSync": true,
    "createdAt": "2026-11-14T20:00:00.000Z",
    "expiresAt": "2026-11-15T20:00:00.000Z",
    "members": [
      { "userId": "usr_01J...", "displayName": "Ada", "role": "host" }
    ]
  },
  "inviteToken": "inv_...",
  "inviteUrl": "absolute-cinema://join?room=rm_01J...&token=inv_..."
}
```

The raw invite token is returned once; only its hash is stored. Regenerating
the invite invalidates the old link.

### POST /rooms/:id/join

```json
{ "inviteToken": "inv_..." }
```

Returns the same room shape as `GET /rooms/:id`. If the room already has two
members, returns `room_full`. If the invite is invalid/expired, `invalid_invite`.

### GET /rooms/:id

Requires membership. Returns room, members, current media descriptor and the
canonical timeline.

### POST /rooms/:id/close

Host only. Ends the room, disconnects members and cascades chat deletion after
the retention window.

### POST /rooms/:id/leave

Removes the caller. If both members leave, the room becomes `ended` and is
eligible for cleanup.

### GET /rooms/:id/messages?before=<messageId>&limit=50

Members only. Keyset pagination, newest first. `limit` max 50.

```json
{
  "messages": [
    {
      "id": "msg_01J...",
      "senderId": "usr_01J...",
      "displayName": "Ada",
      "content": "Ready when you are",
      "createdAt": "2026-11-14T20:05:00.000Z"
    }
  ],
  "nextBefore": "msg_01H..."
}
```

### GET /voice/ice

Returns STUN and time-limited TURN credentials.

```json
{
  "stunUrls": ["stun:turn.example.com:3478"],
  "turn": {
    "urls": ["turn:turn.example.com:3478?transport=udp", "turn:turn.example.com:3478?transport=tcp"],
    "username": "1731603600:usr_01J...",
    "credential": "base64-hmac",
    "expiresAt": "2026-11-14T21:00:00.000Z"
  }
}
```

### GET /health

```json
{ "status": "ok", "version": "0.1.0", "time": "2026-11-14T20:00:00.000Z", "db": "ok" }
```

### GET /config

Public client configuration; no secrets.

```json
{
  "protocolVersion": 1,
  "maxRoomMembers": 2,
  "features": { "voice": true, "youtube": false, "websiteAdapters": false },
  "turnRealm": "turn.example.com"
}
```

### Error shape

```json
{
  "error": {
    "code": "room_full",
    "message": "This room already has two members.",
    "retryable": false,
    "details": {}
  }
}
```

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `invalid_body` | Zod validation failed |
| 401 | `unauthenticated` | Missing/invalid device token |
| 403 | `forbidden` | Not a member / not host |
| 404 | `room_not_found` | Unknown or expired room |
| 409 | `room_full` | Two members already |
| 409 | `invalid_invite` | Bad/expired invitation |
| 410 | `room_ended` | Room closed or expired |
| 429 | `rate_limited` | Slow down; `retryAfterMs` in details |
| 500 | `internal` | No internals leaked to the client |

## 3. WebSocket lifecycle

1. Client opens `wss://api.example.com/v1/ws`.
2. First frame within 5 s:

```json
{ "v": 1, "event": "authenticate", "data": { "ticket": "wst_..." } }
```

3. Server replies `auth.ok` with user and `serverTime`, or closes with 4401.
4. Client sends `room.resume` or joins via REST first, then `room.subscribe`.
5. Heartbeat: client `connection.ping {clientSent}` every 5 s; server replies
   `connection.pong {clientSent, serverTime}`. Missed 3 → reconnect.

### Client → server events

| Event | Data |
|---|---|
| `authenticate` | `{ticket}` |
| `room.resume` | `{roomId, lastRevision}` |
| `media.propose` | `MediaDescriptor` |
| `media.ready` | `{mediaId, ready, durationSec?, tracks?}` |
| `playback.intent` | `{action, position?, rate?, baseRevision}` |
| `playback.report` | `{position, paused, buffering, rate, driftMs?, atServerTime?}` |
| `chat.send` | `{clientId, content}` |
| `chat.typing` | `{typing}` |
| `chat.reaction` | `{messageId, emoji}` |
| `voice.join` | `{}` |
| `voice.leave` | `{}` |
| `voice.signal` | `{to, type, payload}` |
| `connection.ping` | `{clientSent}` |

### Server → client events

| Event | Data |
|---|---|
| `auth.ok` | `{user, serverTime}` |
| `room.snapshot` | `{room, members, media, timeline, recentMessages, voice}` |
| `room.member.joined` | `{member}` |
| `room.member.left` | `{userId, reason}` |
| `room.closed` | `{reason}` |
| `media.proposed` | `MediaDescriptor` |
| `media.state` | `{mediaId, readyBy: string[], mismatchedBy: string[]}` |
| `playback.state` | `PlaybackTimeline` + `reason` |
| `playback.report.ack` | `{receivedAt, driftMs}` |
| `chat.message` | `ChatMessage` |
| `chat.typing` | `{userId, typing, expiresAt}` |
| `chat.reaction` | `{messageId, userId, emoji}` |
| `voice.state` | `{participants: string[], enabled}` |
| `voice.signal` | `{from, type, payload}` |
| `connection.pong` | `{clientSent, serverTime}` |
| `error` | `{code, message, retryable, details}` |

## 4. Playback timeline

```ts
type PlaybackTimeline = {
  mediaId: string | null;
  anchorPosition: number;   // seconds
  anchorServerTime: number; // epoch ms
  playbackRate: number;
  paused: boolean;
  revision: number;
  controllerId: string | null;
};
```

Derivation:

```ts
function positionAt(tl: PlaybackTimeline, serverNow: number): number {
  if (tl.paused || tl.mediaId == null) return tl.anchorPosition;
  const elapsed = (serverNow - tl.anchorServerTime) / 1000;
  return Math.max(0, tl.anchorPosition + elapsed * tl.playbackRate);
}
```

Worked example: anchor 125.42 s at server time `1731600000000`, rate 1.0.
At `1731600005000` the expected position is `130.42` s. If a client reports
`130.30`, drift is `-120 ms` (client is behind). Sign convention: positive means
the client is ahead.

### Intent validation

`playback.intent` actions: `play`, `pause`, `seek`, `set_rate`.

- Allowed rates: `0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0`.
- `seek` position is clamped to `[0, duration]`; unknown duration means only
  lower clamp.
- `baseRevision` must equal the current revision. A mismatch returns
  `stale_revision` and the current snapshot.
- The server ignores duplicate intents with the same `requestId` for 30 s
  (idempotency), returning the last result.
- Rejected intents do not mutate `revision`.

### Broadcast

```json
{
  "v": 1,
  "event": "playback.state",
  "serverTime": 1731600000123,
  "data": {
    "mediaId": "md_01J...",
    "anchorPosition": 125.42,
    "anchorServerTime": 1731600000123,
    "playbackRate": 1,
    "paused": false,
    "revision": 43,
    "controllerId": "usr_01J...",
    "reason": "intent"
  }
}
```

`reason` is one of `intent`, `initial`, `buffering`, `resume`, `recovery`.

### Ready gating

The timeline does not advance until both members have sent `media.ready` for
the same `mediaId`. A newly loaded source starts in `paused: true` with
`anchorPosition: 0`. This prevents the "scrubber runs over a black frame" race
on large files.

## 5. Buffering protocol

Client detects `paused-for-cache`:

```json
{
  "v": 1,
  "event": "playback.report",
  "data": {
    "position": 412.8,
    "paused": false,
    "buffering": true,
    "rate": 1
  }
}
```

If `keepInSync` is true, the server:

1. pauses the timeline at `min(currentPosition, reportingClientPosition)`;
2. increments `revision`;
3. broadcasts `playback.state` with `reason: "buffering"`;
4. waits for `playback.report {buffering:false}` from the affected client;
5. schedules resume with a 400 ms lead and broadcasts `reason: "resume"`.

If recovery exceeds 10 s, the server does not force a wait forever; the UI
offers "Continue without waiting", which sets `keepInSync=false` for the
session.

Guard rails: at most one buffering pause per 15 s per room; a `ready` report
without a prior buffering report cannot trigger a resume broadcast.

## 6. Chat

```json
{
  "v": 1,
  "event": "chat.send",
  "requestId": "c_01J...",
  "data": { "clientId": "local_01J...", "content": "Ready when you are" }
}
```

Server-assigned message:

```json
{
  "v": 1,
  "event": "chat.message",
  "serverTime": 1731600060000,
  "data": {
    "id": "msg_01J...",
    "roomId": "rm_01J...",
    "senderId": "usr_01J...",
    "displayName": "Ada",
    "content": "Ready when you are",
    "createdAt": 1731600060000,
    "clientId": "local_01J..."
  }
}
```

- Delivery confirmation: the `chat.message` echo with the same `clientId` marks
  the optimistic bubble as delivered. The `requestId` ack is optional.
- Typing indicator: send at most once per 2 s; server expires it after 4 s.
- Reactions: a short emoji string (1–8 graphemes), one per user per message;
  sending the same emoji again removes it.
- HTML is never rendered. The server strips control characters and trims.
- Chat history requires membership; messages are deleted with the room after
  the retention window (default 24 h after room end, configurable).

## 7. Voice signaling

Disabled by default. Signaling only; media is WebRTC P2P.

```json
{ "v": 1, "event": "voice.join", "data": {} }
```

Server replies `voice.state {participants:[...], enabled:true}` and notifies the
peer. The initiator creates an offer:

```json
{
  "v": 1,
  "event": "voice.signal",
  "data": {
    "to": "usr_other",
    "type": "offer",
    "payload": { "sdp": "...", "type": "offer" }
  }
}
```

Candidates use `type:"candidate"` with `payload:{candidate, sdpMid, sdpMLineIndex}`.
The server relays to `to` only, after verifying both users are in the same room
and voice is enabled. It rejects payloads over 32 KiB and never logs SDP/ICE
contents. On failure, voice reports `voice.unavailable`; playback is unaffected.

## 8. Reconnection and ordering

- Every server broadcast carries a monotonic `revision` for timeline changes;
  clients discard `revision <= local`.
- Chat and presence are ordered per connection; the server is the single writer
  for message ids.
- On reconnect: exponential backoff 0.5 s → 15 s with ±20% jitter; after open,
  `room.resume`; server returns a full snapshot, not a replay log.
- Duplicate intents are deduplicated by `requestId` (30 s TTL).
- The server closes sockets that are unauthenticated after 5 s, send invalid
  JSON three times, or exceed rate limits.

## 9. Rate limits

| Action | Limit |
|---|---|
| `playback.intent` | 10 / 2 s per user, burst 4 |
| `playback.report` | 2 / s per user |
| `chat.send` | 10 / 10 s per user |
| `chat.typing` | 1 / 2 s per user |
| `voice.signal` | 50 / 10 s per user |
| `POST /auth/guest` | 5 / hour per IP |
| `POST /rooms` | 10 / hour per user |
| Join attempts | 10 / 10 min per IP |
| WS connects | 20 / 10 min per IP |

Exceeding a limit returns `rate_limited` with `retryAfterMs`; repeated abuse
closes the socket (4408).

## 10. Database schema (MVP)

```sql
create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index device_tokens_user_idx on device_tokens(user_id);

create table ws_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  ticket_hash bytea not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index ws_tickets_expiry_idx on ws_tickets(expires_at);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references users(id),
  name text not null check (char_length(name) between 1 and 80),
  status text not null default 'waiting'
    check (status in ('waiting','active','ended')),
  invite_token_hash bytea not null,
  keep_in_sync boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  ended_at timestamptz
);

create table room_members (
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'guest' check (role in ('host','guest')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- Enforce exactly two members at the database boundary.
create or replace function enforce_room_capacity() returns trigger as $$
begin
  if (select count(*) from room_members where room_id = new.room_id) >= 2 then
    raise exception 'room_full';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger room_capacity
before insert on room_members
for each row execute function enforce_room_capacity();

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index chat_room_created_idx on chat_messages(room_id, created_at desc);

create table chat_reactions (
  message_id uuid not null references chat_messages(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table room_timeline_snapshots (
  room_id uuid primary key references rooms(id) on delete cascade,
  media_id text,
  anchor_position double precision not null default 0,
  anchor_server_time bigint not null,
  playback_rate double precision not null default 1,
  paused boolean not null default true,
  revision bigint not null default 0,
  controller_id uuid references users(id),
  media_descriptor jsonb,
  updated_at timestamptz not null default now()
);
```

Notes:

- Hot timeline state lives in memory; the snapshot row is updated on mutation
  with a 500 ms debounce.
- Invite tokens and WS tickets are stored as hashes, never plaintext.
- Cleanup job: `delete from rooms where expires_at < now() - interval '24 hours'`
  cascades members, chat, reactions and snapshots.
- No media bytes, local paths, or chat encryption keys are stored.

## 11. Message sequences

### Create and join

```text
A: POST /auth/guest ─────────────► user + device token
A: POST /rooms ─────────────────► room + invite URL
A: POST /auth/ws-ticket ────────► ticket
A: WS authenticate ─────────────► auth.ok
A: WS room.subscribe ───────────► room.snapshot
B: POST /auth/guest, /ws-ticket
B: POST /rooms/:id/join ────────► room
B: WS authenticate, room.resume ► room.snapshot
A/B: media.propose / media.ready
S: playback.state (paused, 0) ──► both
```

### Play

```text
A: playback.intent {play, baseRevision: 7}
S: validate membership, revision, media ready
S: anchor = positionAt(now); revision = 8
S: broadcast playback.state (revision 8, reason intent)
A/B: schedule apply at serverNow + 150ms
A/B: playback.report after 1s
S: drift computed; no mutation unless correction needed
```

### Buffering

```text
B: playback.report {buffering: true, position: 412.8}
S: pause timeline at 412.8, revision 9, reason buffering
S: broadcast state ──► both pause
B: playback.report {buffering: false}
S: schedule resume +400ms, revision 10, reason resume
S: broadcast state ──► both play at 412.8 + elapsed
```

### Reconnect

```text
A: WS reconnect (backoff)
A: authenticate {fresh ticket}
A: room.resume {lastRevision: 12}
S: room.snapshot (revision 15, timeline, media, chat)
A: discard if revision <= 15; apply if newer
A: if media descriptor mismatch → pause + prompt
```
