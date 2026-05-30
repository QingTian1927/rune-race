# Backend integration

The web client is **wired to the live server** for lobby and online play. Local mode uses the same rules package without sockets.

## Source of truth

| Data | Authority |
|------|-----------|
| Lobby membership, ready, countdown | Server `lobby:snapshot` |
| Game state, dice, moves | Server `game:state_snapshot` |
| Player id + display name | Client `localStorage` via `lib/playerSession.ts` |
| Board layout in editor | Client JSON (export only in MVP) |
| Dice animation timing | Client `dicePresentation.ts` |

## HTTP (`lib/api.ts`)

| Function | Endpoint |
|----------|----------|
| `fetchPublicRooms` | `GET /api/rooms` |
| `createRoom` | `POST /api/rooms` |
| `resolveRoomByCode` | `GET /api/rooms/by-code/:joinCode` |
| `joinMatchmaking` | `POST /api/matchmaking/join` |
| `leaveMatchmaking` | `DELETE /api/matchmaking/leave` |
| `getMatchmakingStatus` | `GET /api/matchmaking/status?playerId=` |

## Socket (`lib/socket.ts`)

Singleton `io(API_BASE || undefined)` with websocket + polling.

### Lobby (`useLobbySocket`)

Emit: `lobby:join`, `lobby:set_color`, `lobby:ready`, `lobby:unready`, `lobby:leave`, host actions, `lobby:sync_request`.

Listen: `lobby:snapshot`, `lobby:start_countdown`, `lobby:start_countdown_cancelled`, `lobby:game_started`, `lobby:error`, `lobby:closed`, `lobby:kicked`, `lobby:removed`.

**Leave behavior (client):**

- **Rời phòng** / **← Trang chủ** on `LobbyPage` → `emitLeaveLobby` then navigate.
- **Rời game** on `OnlineGamePage` → same (`lobby:leave` removes from lobby and forfeits match).
- **Lobby → game** navigation sets `rune-race-lobby-retain` so unmount does **not** auto-leave (player stays in lobby for Back link).
- Do **not** call `lobby:leave` on hook unmount — avoids React StrictMode destroying rooms in dev.

Optional `onRemoved` callback redirects home on `lobby:closed` / `lobby:kicked` / `lobby:removed`.

### Game (`useGameSocket`)

Emit: `game:join`, `game:roll`, `game:choose_move`, `game:sync_request`.

Listen: `game:connected`, `game:state_snapshot`, `game:error`.

**Snapshots:** `applyAuthoritativeState(state, { deltaEvents: payload.events })`. Treat `events` as **delta** during play; full list on join/sync.

## Player identity (`lib/playerSession.ts`)

- `rune-race-player-id` — stable anonymous id (`anon-{uuid}`).
- `rune-race-player-name` — display name for lobby.
- `usePlayerIdentity()` reads both from `localStorage`.

UUID generation uses `randomUUID` → `getRandomValues` → `Math.random` fallback for **HTTP LAN** (non-secure context).

## Presentation vs authority

Online rolls may include move resolution in one snapshot. The client:

1. Detects `dice_roll` in delta + version bump.
2. Gates UI (~3s): no token animation, no move arrows, no roll button.
3. Applies pending state after animation.

Do not defer turn separately from tokens (causes desync); use `createGatedDisplayState` in `dicePresentation.ts`.

## UI permissions (online)

`OnlineGamePage` passes to `GameView`:

| Input | Rule |
|-------|------|
| `canRoll` | `turn.currentPlayerId === playerId` + `waiting_roll` + `!isPresentingDice` + `status === 'playing'` |
| `localPlayerId` | Move-selection arrows only for this client's pawns when `waiting_choice` with multiple moves |
| `isPresentingDice` | From `useGameSocket` / `usePresentationGameState`; freezes tokens and delays HUD turn/finish panels |

Opponents see board updates from snapshots but not selection arrows or roll button.

**HUD vs server**

The server does not drive HUD text or layout. Clients derive:

- Finish order from `token_finished` events in snapshot history
- Current turn label from `turn.currentPlayerId` (display delayed after animations)
- Turn banner from local turn ownership + phase (`waiting_choice` vs `waiting_roll`)

There is no socket field for “show move list”; multiple moves are chosen via `game:choose_move` after the player picks a pawn on the board.

## Environment

| Variable | Meaning |
|----------|---------|
| `VITE_API_URL` | API + socket base (e.g. `http://192.168.1.10:3000`). Empty = same origin + Vite proxy. |

Place variables in the **repo root** `.env` (see `.env.example`). Vite `envDir` points at the monorepo root so one file serves web and server in local dev.

**Server-only** (same `.env` file, no `VITE_` prefix): `PORT`, `CLIENT_ORIGIN`.

### LAN checklist

1. Server: `0.0.0.0:3000` (default).
2. Web: `pnpm dev --host`.
3. Other device: `http://<host-ip>:5173`.
4. If socket fails cross-origin, set `VITE_API_URL` to `http://<host-ip>:3000`.

## Shared protocol

Extend only via `packages/shared`:

- `src/protocol/events.ts`
- `src/schemas/events.ts`
- `src/types/lobby.ts`, `src/types/game.ts`

Then update [protocol-reference](./protocol-reference.md) and [server socket contract](../../server/docs/socket-contract.md).

## Minimal checklist for new client features

1. Add intent to shared `ClientToServerEvents` + Zod schema.
2. Implement handler in `apps/server/src/socket/handlers.ts`.
3. Add hook method or page handler in `apps/web`.
4. Map snapshot fields in `GameView` / `BoardPieces` if visual.

Avoid socket calls inside Three.js leaf components unless the interaction is purely local.
