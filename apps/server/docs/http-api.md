# HTTP API

## Base URL

Development: `http://localhost:3000`

The web client uses `VITE_API_URL` (empty = same origin). Vite dev server proxies `/api` and `/socket.io` to port 3000.

Authenticated routes expect `Authorization: Bearer <supabase_access_token>`.

## Routes

### `GET /`

Server status.

```json
{ "message": "Rune Race Server", "status": "running" }
```

### `GET /health`

```json
{ "status": "ok", "timestamp": "2026-05-21T12:00:00.000Z" }
```

### `GET /api/public/feature-flags`

Public client toggles (no auth).

```json
{ "accountNudgeEnabled": true }
```

### `GET /api/rooms`

Public lobby list (visibility `public`, status `lobby` or `countdown`).

```json
{
  "rooms": [
    {
      "lobbyId": "uuid",
      "joinCode": "Ab12Cd34",
      "name": "My room",
      "playerCount": 2,
      "maxPlayers": 4,
      "hasPassword": false,
      "status": "lobby"
    }
  ]
}
```

### `GET /api/rooms/by-code/:joinCode`

Resolve **8-character case-sensitive** join code → lobby metadata. `404` if not found.

```json
{
  "lobbyId": "uuid",
  "joinCode": "Ab12Cd34",
  "name": "My room",
  "playerCount": 1,
  "maxPlayers": 4,
  "hasPassword": true,
  "status": "lobby"
}
```

### `GET /api/rooms/:lobbyId`

Fetch a single lobby list entry by id. `404` if not found or not listable.

### `POST /api/rooms`

Create a lobby; creator is host.

**Body:**

```json
{
  "playerId": "anon-optional-uuid",
  "playerName": "Player",
  "name": "Optional room name",
  "password": "optional",
  "visibility": "public"
}
```

**Response:**

```json
{
  "lobbyId": "uuid",
  "joinCode": "Ab12Cd34",
  "playerId": "anon-..."
}
```

Client should then `lobby:join` over Socket.IO with the same `playerId`.

### Matchmaking

#### `POST /api/matchmaking/join`

Enqueue for auto-match. Creates a **public** lobby when matched.

**Body:** `{ "playerId": "...", "playerName": "..." }`

**Response (queued):**

```json
{
  "status": "queued",
  "waitedSeconds": 12,
  "queueSize": 3
}
```

**Response (matched):**

```json
{
  "status": "matched",
  "waitedSeconds": 0,
  "queueSize": 0,
  "lobbyId": "uuid",
  "joinCode": "Ab12Cd34"
}
```

#### `DELETE /api/matchmaking/leave`

**Body:** `{ "playerId": "..." }` → `{ "status": "left" }`

#### `GET /api/matchmaking/status?playerId=...`

Poll queue/match state (same shape as join response).

### Profile & auth

#### `GET /api/profile`

Authenticated user's full profile (includes phone). `401` if no valid token.

#### `GET /api/profile/:id`

Public profile by user id (no phone).

#### `PATCH /api/profile`

Update own profile fields: `displayName`, `bio`, `avatarEmoji`, `phone`.

#### `PATCH /api/player/display-name`

Update display name only: `{ "displayName": "..." }`.

#### `POST /api/auth/link-anon`

Merge anonymous profile into newly registered account: `{ "anonId": "..." }`.

Response: `{ "merged": boolean, "profile": Profile }`.

### Admin (separate admin app)

- `GET /api/admin/analytics/*` — live stats, timeseries, top players
- `GET/PATCH /api/admin/settings` — server-side settings

### `POST /dev/create-room` (deprecated)

Legacy helper; prefer `POST /api/rooms`. Returns `lobbyId`, `joinCode`.

## Notes

- HTTP does not join the socket room; always follow with `lobby:join`.
- `playerId` is client-generated (`anon-{uuid}`) or Supabase user id when authenticated.
- Passwords are hashed server-side; never returned in list responses (host receives plaintext via `lobby:host_secrets` on socket).
