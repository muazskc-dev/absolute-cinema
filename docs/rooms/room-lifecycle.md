# Room Lifecycle and Persistence Contract

**Status:** architecture contract for Sprint 2 and later. Sprint 1 implements
only the local UI prototype.
**Principle:** a room is a persistent relationship between two people, not a
process that dies when the application closes.

---

## 1. Two entities, one identity

### Persistent room

A durable PostgreSQL record. It survives disconnects, application restarts and
server restarts. It is what Room History lists.

```ts
type PersistentRoom = {
  id: string;                 // stable public identifier (not sequential)
  ownerId: string;
  name: string;

  passwordHash: string | null; // Argon2id encoded hash, never plaintext

  createdAt: string;           // ISO 8601 UTC
  lastActiveAt: string;        // ISO 8601 UTC
  archivedAt: string | null;
  deletedAt: string | null;    // soft delete; hard purge by retention job
};
```

Membership is a separate relation so both participants have stable roles:

```ts
type RoomMember = {
  roomId: string;
  userId: string;
  role: "owner" | "partner";
  joinedAt: string;
  lastSeenAt: string;
};
```

### Temporary room session

An in-memory runtime owned by the API process. It exists only while the room is
awake. It is never stored as the source of truth for identity.

```ts
type RoomSession = {
  id: string;
  roomId: string;
  state: "waking" | "waiting" | "live" | "reconnecting";

  participantIds: string[];    // max 2

  timeline: {
    revision: number;
    anchorMediaTime: number;
    anchorServerTime: number;
    paused: boolean;
    rate: number;
    updatedBy: string;
  } | null;

  startedAt: string;
  lastActivityAt: string;
  reconnectDeadlineAt: string | null;
};
```

The session is created by a room actor: a small in-process object keyed by
`roomId`. One actor per awake room. No VM, no container, no dedicated process
per room. The two-person product does not justify that cost.

---

## 2. State machine

```
                 authorized join
   DORMANT ───────────────────────► WAKING
      ▲                                │
      │                                │ runtime ready
      │                                ▼
      │                             WAITING
      │                                │
      │                                │ second participant joins
      │                                ▼
      │                              LIVE
      │                                │
      │                                │ connection lost
      │                                ▼
      │                          RECONNECTING
      │                                │
      │        grace expired           │ reconnect succeeds
      └────────────────────────────────┴──► LIVE

   Any state: owner delete → DELETED (soft), then retention purge.
```

### DORMANT

- Persistent record exists.
- No actor, no session, no WebSocket room state.
- Visible in Room History.
- Wakeable by an authorized member.

### WAKING

Entered only after authorization succeeds. Steps are ordered:

1. Validate room existence and `deletedAt`/`archivedAt` policy.
2. Validate membership or a valid invitation token.
3. Verify password if `passwordHash` is set.
4. Acquire the per-room activation lock (`SETNX`/`FOR UPDATE` style) so two
   simultaneous joins cannot create two actors.
5. Generate a new session ID.
6. Create the room actor and restore safe metadata.
7. Return the session and issue a WebSocket ticket.

The runtime must not start before step 3. An unauthorized or wrong-password
request does no work beyond a constant-cost hash verification.

### WAITING

- Exactly one participant connected.
- UI: `Waiting · 1/2`, `Waiting for the other participant.`
- Invitation link remains valid.
- Empty-room timer is not running while one participant is present.

### LIVE

- Two participants connected.
- Shared timeline begins in Sprint 3; Sprint 1 only renders the state.
- Room capacity is enforced at two. A third connection receives
  `ROOM_FULL` and never joins the actor.

### RECONNECTING

- A participant socket dropped.
- The actor and timeline stay alive during a grace window.
- Reconnect with a valid WS ticket restores the same participant slot.
- If the grace expires with zero participants, the room hibernates.
- If one participant remains, the room returns to WAITING after the dropped
  participant's grace expires.

---

## 3. Timing configuration

Initial values, configurable and benchmarked in Sprint 2:

| Setting | Initial value | Purpose |
|---|---:|---|
| WebSocket ticket lifetime | 60 s | Single-use upgrade credential |
| Reconnect grace | 90 s | Survive transient network loss |
| Empty-room hibernation | 120 s | Allow short returns before actor disposal |
| Timeline snapshot debounce | 2 s | Database write reduction |
| Timeline heartbeat | 4 Hz | Client telemetry cadence |
| Password attempt window | 15 min | Rate-limit accounting |
| Password attempt limit | 10 | Per room + IP + account key |

Timers are per room and cancelled when state changes. A hibernation timer never
runs while a participant is connected.

---

## 4. Hibernation and wake

When the last participant leaves:

1. Mark session `reconnecting` if a reconnect window applies.
2. After the grace window, dispose of the actor, timeline and sockets.
3. Update `lastActiveAt`.
4. Set the visible state to DORMANT.
5. Keep the database row, members, name, password hash and history.

Wake is idempotent: a second wake request while an actor exists joins the
existing session instead of creating another. The activation lock key is
released when the actor is created or waking fails.

---

## 5. Password flow

### Set / change

- Owner only.
- Password length: 12–128 characters.
- Hash with Argon2id: memory ≥19 MiB, iterations ≥2, parallelism 1, unique salt.
- Store only the encoded hash.
- Never log the password or the hash.
- Never return the hash in any API response.
- Changing the password invalidates existing invitation tokens that are bound
  to the password state, but does not eject currently connected participants.

### Verify on join

1. Resolve the invitation token to a room ID.
2. Load the hash.
3. Verify with Argon2id in constant time with respect to hash comparison.
4. On failure, return the same generic error used for an invalid invitation:
   `Unable to join. Check the invitation and password.`
5. Rate-limit by room, account and IP. Increase delay after repeated failures.
6. Do not reveal whether the room exists, is protected, or the password was
   close.

An invitation link never bypasses the password. The password is sent only over
TLS in a request body, never in a URL or query string.

### Removal

- Owner can remove protection.
- The hash is set to `null`.
- Previously issued password-bound tokens become ordinary invitation tokens.
- The previous password is never displayed or recoverable.

---

## 6. Authorization and capacity

Every room operation validates, in order:

1. Authenticated device/user.
2. Room exists and is not deleted.
3. Caller is a member or presents a valid invitation.
4. Archived policy permits the operation.
5. Password requirement, if any.
6. Capacity (≤2 connected participants).

Broadcasting, renaming, password changes, archiving and deletion are owner
actions. Reading history is member-only. Invitation copy is member-only.

Errors are stable codes, not prose, so the UI can render honest states:

```text
ROOM_NOT_FOUND
ROOM_UNAVAILABLE
ROOM_FULL
INVITATION_INVALID
INVITATION_EXPIRED
PASSWORD_REQUIRED
PASSWORD_INCORRECT
NOT_A_MEMBER
NOT_OWNER
ROOM_ARCHIVED
```

`PASSWORD_INCORRECT` and `INVITATION_INVALID` are deliberately
indistinguishable in user-facing copy.

---

## 7. Invitations

- Opaque, random, 128-bit tokens; stored hashed.
- Scope: one room, optional expiry, optional single use.
- The URL carries only the token: `absolute-cinema://join/<token>`.
- The server resolves the token; the desktop client never trusts a room ID from
  the link.
- Regenerating an invitation invalidates the previous token.
- Passwords are never embedded in invitation links.

Sprint 1 uses display-only demo codes (`AC-XXXX`). They are not security
tokens and are labeled development data.

---

## 8. Persistence and retention

- Dormant rooms are retained by default. Age alone does not delete a room.
- Owner actions: rename, password, copy invitation, wake, archive, delete.
- Archive hides a room from the default history list and is reversible.
- Delete is a soft delete (`deletedAt`), followed by a retention purge.
- A future retention policy must be explicit, documented and user-visible.
- Account deletion cascades rooms the user owns, after confirmation.
- `lastActiveAt` updates on meaningful activity, not every heartbeat.

---

## 9. Database consistency

- One transaction creates the room and its owner membership.
- `lastActiveAt` updates are monotonic: never move backwards on a late write.
- Session state lives in memory; only durable timeline snapshots and
  `lastActiveAt` are written.
- A process crash loses at most the last snapshot window; on restart no actor
  exists and rooms are effectively dormant until woken.
- The activation lock prevents duplicate actors across API instances.
- Deleting a room while an actor exists signals the actor to stop accepting
  joins, then disposes of it.

---

## 10. Privacy

Never persist automatically:

- Local file paths.
- Signed media URLs or tokens inside URLs.
- DRM session data.
- Local file contents.
- Passwords or password hashes in client storage.

Store only safe metadata required for history: room name, members, password
state, timestamps, archive state. If a previous source is unavailable, ask the
participant to provide it again. Never imply that another computer can open a
local path.

---

## 11. Failure modes and required behavior

| Failure | Required behavior |
|---|---|
| Two simultaneous wakes | One actor; second request joins it |
| Password brute force | Rate limit, generic errors, backoff |
| Third participant | `ROOM_FULL`, no actor mutation |
| API crash | Rooms wake from database; in-memory sessions lost |
| Reconnect after grace | New session, fresh timeline anchor |
| Deleted room wake | `ROOM_NOT_FOUND`, return to history |
| Archived room wake | `ROOM_ARCHIVED` until unarchived |
| Invitation expiry | `INVITATION_EXPIRED`, offer a new invitation |
| Owner leaves | Room can remain live for the partner until grace expires |
| Clock skew | Clients estimate offset; server time is authoritative |

---

## 12. Sprint 2 implementation checklist

- [ ] PostgreSQL schema: rooms, members, invitations, timeline snapshots.
- [ ] Fastify routes: create, list history, wake, join preview, join, leave,
      rename, password, archive, delete.
- [ ] Per-room actor registry with activation lock.
- [ ] WebSocket tickets (60 s, single use) and room socket.
- [ ] Argon2id hashing and rate limiting.
- [ ] Hibernation and reconnect timers.
- [ ] Structured errors and request validation (Zod).
- [ ] Integration tests for concurrent wake, capacity, password failure,
      reconnect, hibernation, archive/delete.
- [ ] Client switches from demo store to API without UI redesign.
