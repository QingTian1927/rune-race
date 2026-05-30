# HTTP API

## Base URL

Development: `http://localhost:3000`

The web client uses `VITE_API_URL` (empty = same origin). Vite dev server proxies `/api` and `/socket.io` to port 3000.

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

Enqueue for auto-match. Creates a **public** lobby when matched (listed in `GET /api/rooms`; others may join if seats remain).

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

### `POST /dev/create-room` (deprecated)

Legacy helper; prefer `POST /api/rooms`. Returns `lobbyId`, `joinCode`.

## Notes

- HTTP does not join the socket room; always follow with `lobby:join`.
- `playerId` is client-generated (`anon-{uuid}` in localStorage) and sent with room/matchmaking requests.
- Passwords are hashed server-side; never returned in list responses.
