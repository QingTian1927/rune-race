# Socket.IO contract

Canonical types: `packages/shared/src/protocol/events.ts` and `packages/shared/src/schemas/events.ts`.

## Connection

| Setting | Value |
|---------|--------|
| URL (dev) | `http://localhost:3000` (client uses `io(API_BASE)`) |
| Namespace | default `/` |
| CORS | `*` |
| Validation | `validateCommand(eventName, payload)` before handler logic |

If the client has a Supabase session, it sends `auth: { token }` in the socket handshake. The server verifies that token and binds the socket to that user id.

## Lifecycle overview

### Lobby

1. `lobby:join` → `lobby:connected` + `lobby:snapshot` (room broadcast).
2. `lobby:set_color`, `lobby:ready` / `lobby:unready` → updated `lobby:snapshot`.
3. All players ready → `lobby:start_countdown` `{ seconds: 5 }` + snapshot `status: countdown`.
4. Countdown completes → `lobby:game_started` + initial `game:state_snapshot` on `game:{gameId}`.
5. Clients emit `game:join` with `gameId`.

### Game

1. `game:join` → `game:connected` + full `game:state_snapshot` (all `events` on first join).
2. `game:roll` / `game:choose_move` → `game:state_snapshot` with **delta** `events`.
3. Reconnect: `game:sync_request` → latest full snapshot to that socket only.

---

## Client → Server

### Lobby

| Event | Purpose |
|-------|---------|
| `lobby:join` | Join by `lobbyId` and/or `joinCode`; optional `password` |
| `lobby:set_color` | Pick `red` \| `blue` \| `green` \| `yellow` |
| `lobby:ready` | Mark ready (may start countdown) |
| `lobby:unready` | Cancel ready; emits `lobby:start_countdown_cancelled` |
| `lobby:leave` | Leave lobby |
| `lobby:kick` | Host kicks `targetPlayerId` |
| `lobby:cancel_countdown` | Host cancels start countdown |
| `lobby:update_settings` | Host: `name`, `password`, `clearPassword` |
| `lobby:transfer_host` | Host transfers to `newHostPlayerId` |
| `lobby:sync_request` | Request current `lobby:snapshot` |

**`lobby:join` payload:**

```ts
{
  playerId: string
  playerName: string
  lobbyId?: string
  joinCode?: string
  password?: string
}
```

When the handshake contains a valid Supabase access token, the server checks that `playerId` matches the authenticated user id.

### Game

| Event | Payload | Semantics |
|-------|---------|-----------|
| `game:join` | `{ playerId, gameId }` | Must be a player in that game |
| `game:roll` | `{ playerId }` | Current player, phase `waiting_roll` |
| `game:choose_move` | `{ playerId, moveId }` | Phase `waiting_choice`; `moveId` from `legalMoves` |
| `game:sync_request` | `{ playerId }` | Full state resync |
| `game:ping` | `{ playerId }` | Validated; no-op |

For authenticated users, `playerId` must match the Supabase user id attached to the socket.

---

## Server → Client

### Lobby

| Event | Payload |
|-------|---------|
| `lobby:connected` | `{ playerId, lobbyId }` |
| `lobby:snapshot` | `LobbySnapshot` |
| `lobby:start_countdown` | `{ seconds: number }` |
| `lobby:start_countdown_cancelled` | `{ reason: string }` |
| `lobby:game_started` | `{ gameId, lobbyId, firstPlayerId }` |
| `lobby:error` | `{ message, code }` |

**`LobbySnapshot` (summary):**

```ts
{
  lobbyId: string
  joinCode: string
  status: 'lobby' | 'countdown' | 'in_game'
  settings: { name, hasPassword, maxPlayers, minPlayersToStart }
  players: LobbyPlayer[]  // color, ready, connected, isHost
  takenColors: PlayerColor[]
  playerCount: number
  countdownSeconds: number | null
  currentGameId: string | null
  canCountdown: boolean
}
```

### Game

| Event | Payload |
|-------|---------|
| `game:connected` | `{ playerId, gameId }` |
| `game:state_snapshot` | `{ version, state: GameState, events: GameEvent[] }` |
| `game:error` | `{ message, code }` |
| `game:turn_timeout_warning` | `{ secondsRemaining }` — **defined but not emitted yet** |

---

## Snapshot rules

- **`version`** increments on each authoritative change.
- **`events` on gameplay updates:** delta only (new events since last version). Use for animations (`dice_roll`, `token_moved`, etc.).
- **`events` on `game:join` / `game:sync_request`:** full `state.events` array.
- After `handleRoll` with one legal move, a single snapshot may contain both roll and resolve events.
- Do not apply client-side move resolution as source of truth.

## Common error codes

**Lobby:** `JOIN_FAILED`, `SET_COLOR_FAILED`, `READY_FAILED`, `UNREADY_FAILED`, `LEAVE_FAILED`, `KICK_FAILED`, `CANCEL_FAILED`, `SETTINGS_FAILED`, `TRANSFER_FAILED`, `SYNC_FAILED`

**Game:** `JOIN_FAILED`, `ROLL_FAILED`, `MOVE_FAILED`, `SYNC_FAILED`

## Deprecated (do not use)

Old room API names are removed from the server:

- ~~`game:room_snapshot`~~ → `lobby:snapshot`
- ~~`game:start`~~ → automatic start after lobby countdown
- ~~`game:join` with `roomId` + `color`~~ → `lobby:join` then `game:join` with `gameId`
