# Socket.IO contract

Canonical types: `packages/shared/src/protocol/events.ts` and `packages/shared/src/schemas/events.ts`.

## Connection

| Setting | Value |
|---------|--------|
| URL (dev) | `http://localhost:3000` (client uses `io(API_BASE)`) |
| Namespace | default `/` |
| CORS | from `CLIENT_ORIGIN` or permissive in dev |
| Validation | `validateCommand(eventName, payload)` before handler logic |

If the client has a Supabase session, it sends `auth: { token }` in the socket handshake. The server verifies that token and binds the socket to that user id.

## Lifecycle overview

### Lobby

1. `lobby:join` → `lobby:connected` + `lobby:snapshot` (room broadcast); host also gets `lobby:host_secrets`.
2. `lobby:set_color`, `lobby:ready` / `lobby:unready` → updated `lobby:snapshot`.
3. All players ready → `lobby:start_countdown` `{ seconds: 5 }` + snapshot `status: countdown`.
4. Countdown completes → `lobby:game_started` + initial `game:state_snapshot` on `game:{gameId}`.
5. Clients emit `game:join` with `gameId`.

### Leave and disconnect

| Action | Game | Lobby | Broadcast |
|--------|------|-------|-----------|
| `lobby:leave` (explicit) | Forfeit if in match | Remove immediately | `lobby:snapshot`; `lobby:closed` if empty |
| Socket `disconnect` | Forfeit if in match | `connected: false`, then remove after 30s grace | `lobby:snapshot`; `lobby:removed` to timed-out player |
| Host kick | — | Remove immediately (lobby phase only) | `lobby:kicked` to target + `lobby:snapshot` |

Players navigating lobby → game **stay** in the lobby record and socket room; only explicit leave or disconnect grace removes them.

### Game

1. `game:join` → `game:connected` + full `game:state_snapshot` (all `events` on first join).
2. Rune + classic commands → `game:state_snapshot` with **delta** `events` (per-viewer `runeView`).
3. Reconnect: `game:sync_request` → latest full snapshot to that socket only.

### Chat

1. Client in `lobby:{lobbyId}` calls `chat:sync_request` → `chat:history`.
2. `chat:send` → `chat:message` broadcast to lobby room (+ system messages on join/leave).

---

## Client → Server

### Lobby

| Event | Purpose |
|-------|---------|
| `lobby:join` | Join by `lobbyId` and/or `joinCode`; optional `password` |
| `lobby:set_color` | Pick `red` \| `blue` \| `green` \| `yellow` |
| `lobby:ready` | Mark ready (may start countdown) |
| `lobby:unready` | Cancel ready; emits `lobby:start_countdown_cancelled` |
| `lobby:leave` | Leave lobby immediately (and forfeit active game) |
| `lobby:kick` | Host kicks `targetPlayerId` (lobby phase only) |
| `lobby:cancel_countdown` | Host cancels start countdown |
| `lobby:update_settings` | Host: `name`, `password`, `clearPassword`, **`runesEnabled`** |
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

### Chat

| Event | Payload |
|-------|---------|
| `chat:send` | `{ playerId, lobbyId, text }` |
| `chat:sync_request` | `{ playerId, lobbyId }` |

### Game

| Event | Payload | Semantics |
|-------|---------|-----------|
| `game:join` | `{ playerId, gameId }` | Must be a player in that game |
| `game:draw_cards` | `{ playerId, count }` | Active player; `waiting_draw` or `placement_phase`; fails `PLACEMENT_CONFIRMED` if that player already confirmed |
| `game:confirm_draw` | `{ playerId }` | Active player; accept pending draw; fails `PLACEMENT_CONFIRMED` if already confirmed during placement |
| `game:finish_draw` | `{ playerId }` | Active player; `waiting_draw` → opens placement |
| `game:place_marker` | `{ playerId, heldCardId, cellId, displayedIdentityId }` | `placement_phase`; emits `marker_place_rejected` (`placement_confirmed`) if player already confirmed |
| `game:confirm_placement_ready` | `{ playerId }` | `placement_phase` — mark player ready; locks further place/draw for that player; may close early when all ready after min window |
| `game:use_leave_stable` | `{ playerId, heldCardId }` | Active player; `leave_stable_phase` only |
| `game:select_honesty_reward` | `{ playerId, cardType }` | Active player with a claimable honesty reward; `waiting_draw` or `placement_phase`; `cardType` must be one of the 5 support cards. Appends to hand even at/over 5 cards. If the player never selects, the server picks at random when placement closes |
| `game:roll` | `{ playerId }` | Active player; `waiting_roll` or `leave_stable_phase`. Fails with `PLACEMENT_NOT_CLOSED` during `placement_phase` |
| `game:choose_move` | `{ playerId, moveId }` | Phase `waiting_choice`; `moveId` from `legalMoves` |
| `game:choose_swap` | `{ playerId, targetTokenId }` | Phase `waiting_swap_choice` |
| `game:sync_request` | `{ playerId }` | Full state resync |
| `game:ping` | `{ playerId }` | Validated; no-op |

For authenticated users, `playerId` must match the Supabase user id attached to the socket.

---

## Server → Client

### Lobby

| Event | Payload |
|-------|---------|
| `lobby:connected` | `{ playerId, lobbyId }` |
| `lobby:host_secrets` | `{ roomPassword: string \| null }` — host only |
| `lobby:snapshot` | `LobbySnapshot` |
| `lobby:start_countdown` | `{ seconds: number }` |
| `lobby:start_countdown_cancelled` | `{ reason: string }` |
| `lobby:game_started` | `{ gameId, lobbyId, firstPlayerId }` |
| `lobby:error` | `{ message, code }` |
| `lobby:closed` | `{ lobbyId, reason: 'empty' }` |
| `lobby:kicked` | `{ lobbyId, reason: 'kicked' }` |
| `lobby:removed` | `{ lobbyId, reason: 'left' \| 'disconnect_timeout' }` |

**`LobbySnapshot` (summary):**

```ts
{
  lobbyId: string
  joinCode: string
  status: 'lobby' | 'countdown' | 'in_game'
  settings: { name, hasPassword, maxPlayers, minPlayersToStart, runesEnabled }
  players: LobbyPlayer[]
  takenColors: PlayerColor[]
  playerCount: number
  countdownSeconds: number | null
  currentGameId: string | null
  canCountdown: boolean
}
```

### Chat

| Event | Payload |
|-------|---------|
| `chat:history` | `{ lobbyId, messages: ChatMessage[] }` |
| `chat:message` | `ChatMessage` |
| `chat:error` | `{ message, code }` |

### Game

| Event | Payload |
|-------|---------|
| `game:connected` | `{ playerId, gameId }` |
| `game:state_snapshot` | `ClientGameSnapshot` — see below |
| `game:error` | `{ message, code }` |
| `game:turn_timeout_warning` | `{ secondsRemaining }` — **defined but not emitted**; server auto-resolves via `tickTurnTimeouts` instead |

**`ClientGameSnapshot`:**

```ts
{
  version: number
  state: GameState           // public rune markers only
  events: GameEvent[]        // delta on updates; full on join/sync
  runeView: RuneClientView | null  // { myMarkers: { markerId, cardType }[] }
}
```

---

## Snapshot rules

- **`version`** increments on each authoritative change.
- **`events` on gameplay updates:** delta only (new events since last version). Use for animations (`dice_roll`, `token_stepped`, `marker_triggered`, etc.).
- **`events` on `game:join` / `game:sync_request`:** full `state.events` array.
- **`runeView`:** computed per recipient; never broadcast opponent marker card types in `state`.
- **Per-viewer redaction** (`buildClientGameSnapshot`): opponent `rune.players[*]` hands/streaks/pending draws are stripped; `placement.honestyByPlayer` keeps only the viewer's entry; events are redacted (`cards_drawn` loses `cardTypes`, `marker_placed` is re-attributed to the displayed identity, `honesty_reward_granted` hides `cardType`, and `card_draw_preview` / `held_card_expired` / `marker_place_rejected` / `honesty_reward_available` / `honesty_reward_selected` go to their owner only).
- After `handleRoll` with one legal move, a single snapshot may contain both roll and resolve events.
- Do not apply client-side move resolution as source of truth.

## Common error codes

**Lobby:** `JOIN_FAILED`, `SET_COLOR_FAILED`, `READY_FAILED`, `UNREADY_FAILED`, `LEAVE_FAILED`, `KICK_FAILED`, `CANCEL_FAILED`, `SETTINGS_FAILED`, `TRANSFER_FAILED`, `SYNC_FAILED`

**Chat:** rate limit / validation errors via `chat:error`

**Game:** `JOIN_FAILED`, `ROLL_FAILED`, `MOVE_FAILED`, `DRAW_FAILED`, `FINISH_DRAW_FAILED`, `PLACE_FAILED`, `PLACEMENT_NOT_CLOSED`, `SWAP_FAILED`, `SYNC_FAILED`, `REWARD_SELECT_FAILED` (wraps `NO_CLAIMABLE_REWARD`, `INVALID_REWARD_TYPE`)

## Deprecated (do not use)

Old room API names are removed from the server:

- ~~`game:room_snapshot`~~ → `lobby:snapshot`
- ~~`game:start`~~ → automatic start after lobby countdown
- ~~`game:join` with `roomId` + `color`~~ → `lobby:join` then `game:join` with `gameId`
