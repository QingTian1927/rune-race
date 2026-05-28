# HTTP API

## Base URL

Development: `http://localhost:3000`

The web client uses `VITE_API_URL` (empty = same origin). Vite dev server proxies `/api` and `/socket.io` to port 3000.

Authenticated profile routes use the Supabase access token from the client session.

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

### `POST /api/matchmaking/join`

Enqueue for auto-match.

**Body:** `{ "playerId": "...", "playerName": "..." }`

**Response:**

```json
{
  "status": "queued",
  "waitedSeconds": 12,
  "queueSize": 3
}
```

When matched:

```json
{
  "status": "matched",
  "waitedSeconds": 0,
  "queueSize": 0,
  "lobbyId": "uuid",
  "joinCode": "Ab12Cd34"
}
```

### `DELETE /api/matchmaking/leave`

**Body:** `{ "playerId": "..." }` → `{ "status": "left" }`

### `GET /api/matchmaking/status?playerId=...`

Poll queue/match state (same shape as join response).

### `GET /api/profile`

Return the current authenticated profile. Requires `Authorization: Bearer <supabase_access_token>`.

### `GET /api/profile/:id`

Return a public profile by user id. Available without auth.

### `PATCH /api/profile`

Update the current authenticated profile. Requires `Authorization: Bearer <supabase_access_token>`.

**Body:**

```json
{
  "displayName": "Player",
  "bio": "Short bio",
  "avatarEmoji": "🍓",
  "phone": "optional"
}
```

### `POST /api/auth/link-anon`

Merge a Supabase anonymous profile into the current authenticated profile.

**Body:**

```json
{
  "anonId": "supabase-anon-user-id"
}
```

**Notes:**

- `displayName`, `bio`, `avatarEmoji`, `phone` follow the registered-vs-anon merge rules in the server implementation.
- Stats and items are merged on the server; the anon profile is removed after linking.

### `POST /dev/create-room` (deprecated)

Legacy helper; prefer `POST /api/rooms`. Returns `lobbyId`, `joinCode`.

## Notes

- HTTP does not join the socket room; always follow with `lobby:join`.
- `playerId` is client-generated for guest play, but authenticated Supabase sessions override it on the server when present.
- Passwords are hashed server-side; never returned in list responses.
