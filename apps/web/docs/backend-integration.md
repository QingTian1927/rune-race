# Backend integration

The web client is **wired to the live server** for lobby and online play. Local mode uses the same rules package without sockets.

## Source of truth

| Data | Authority |
|------|-----------|
| Lobby membership, ready, countdown, `runesEnabled` | Server `lobby:snapshot` |
| Game state, dice, moves, rune markers (public) | Server `game:state_snapshot` |
| Your marker card types | Server `runeView` on snapshot |
| Player id + display name | Supabase session or `localStorage` via `usePlayerIdentity` |
| Lobby chat | Server `chat:*` (in-memory, lobby-scoped) |
| Board layout in editor | Client JSON (export only in MVP) |
| Dice animation timing | Client `dicePresentation.ts` |

## HTTP (`lib/api.ts`)

| Function | Endpoint |
|----------|----------|
| `fetchFeatureFlags` | `GET /api/public/feature-flags` |
| `fetchPublicRooms` | `GET /api/rooms` |
| `fetchRoomById` | `GET /api/rooms/:lobbyId` |
| `createRoom` | `POST /api/rooms` |
| `resolveRoomByCode` | `GET /api/rooms/by-code/:joinCode` |
| `joinMatchmaking` | `POST /api/matchmaking/join` |
| `leaveMatchmaking` | `DELETE /api/matchmaking/leave` |
| `getMatchmakingStatus` | `GET /api/matchmaking/status?playerId=` |
| `fetchProfile` | `GET /api/profile` (Bearer token) |
| `fetchProfileById` | `GET /api/profile/:id` |
| `updateProfile` | `PATCH /api/profile` |
| `updateDisplayName` | `PATCH /api/player/display-name` |
| `linkAnonProfile` | `POST /api/auth/link-anon` |

Authenticated requests pass `Authorization: Bearer <supabase_access_token>` when a session exists.

## Socket (`lib/socket.ts`)

Singleton `io(API_BASE || undefined)` with websocket + polling. Optional `auth: { token }` in handshake.

### Lobby (`useLobbySocket`)

Emit: `lobby:join`, `lobby:set_color`, `lobby:ready`, `lobby:unready`, `lobby:leave`, host actions, `lobby:sync_request`.

Listen: `lobby:snapshot`, `lobby:host_secrets` (host), `lobby:start_countdown`, `lobby:start_countdown_cancelled`, `lobby:game_started`, `lobby:error`, `lobby:closed`, `lobby:kicked`, `lobby:removed`.

**Leave behavior (client):**

- **Rời phòng** / **← Trang chủ** on `LobbyPage` → `emitLeaveLobby` then navigate.
- **Rời game** on `OnlineGamePage` → same (`lobby:leave` removes from lobby and forfeits match).
- **Lobby → game** navigation sets `rune-race-lobby-retain` so unmount does **not** auto-leave (player stays in lobby for Back link + chat).
- Do **not** call `lobby:leave` on hook unmount — avoids React StrictMode destroying rooms in dev.

Optional `onRemoved` callback redirects home on `lobby:closed` / `lobby:kicked` / `lobby:removed`.

### Chat (`useRoomChat`)

Emit: `chat:send`, `chat:sync_request`.

Listen: `chat:history`, `chat:message`, `chat:error`.

Works in lobby and in-game (same `lobbyId`). `OnlineGamePage` passes `RoomChatPanel` into `GameView`.

### Game (`useGameSocket`)

Emit: `game:join`, `game:draw_cards`, `game:finish_draw`, `game:place_marker`, `game:confirm_placement_ready`, `game:use_leave_stable`, `game:select_honesty_reward`, `game:roll`, `game:choose_move`, `game:choose_swap`, `game:sync_request`.

Listen: `game:connected`, `game:state_snapshot`, `game:error`.

**Snapshots:** `ClientGameSnapshot` — apply `state` via `applyAuthoritativeState(state, { deltaEvents: payload.events })`; store `runeView` separately for tooltips. Treat `events` as **delta** during play; full list on join/sync.

While in a match, the hook re-emits `lobby:join` so the socket stays in the lobby room for chat and removal events.

## Player identity

- **Guest:** `rune-race-player-id` (`anon-{uuid}`) + `rune-race-player-name` in `localStorage` (`lib/playerSession.ts`).
- **Supabase:** `usePlayerIdentity()` prefers authenticated user id and profile display name; passes `accessToken` to HTTP and socket.

UUID generation uses `randomUUID` → `getRandomValues` → `Math.random` fallback for **HTTP LAN** (non-secure context).

## Presentation vs authority

Online rolls may include move resolution in one snapshot. The client:

1. Detects `dice_roll` in delta + version bump.
2. Gates UI (~3s): no token animation, no move arrows, no roll button.
3. Applies pending state after animation.

Do not defer turn separately from tokens (causes desync); use `createGatedDisplayState` in `dicePresentation.ts`.

Rune marker animations follow the same delta cursor as `tokenMotion.ts` (`token_stepped`, `marker_triggered`, etc.).

## UI permissions (online)

`OnlineGamePage` passes to `GameView`:

| Input | Rule |
|-------|------|
| `canRoll` | `turn.currentPlayerId === playerId` + phase in `waiting_roll` / `leave_stable_phase` + `!isPresentingDice` + `status === 'playing'` |
| `localPlayerId` | Move-selection arrows only for this client's pawns when `waiting_choice` with multiple moves |
| `isPresentingDice` | From `useGameSocket` / `usePresentationGameState`; freezes tokens and delays HUD turn/finish panels |
| Rune draw | Active player only during `waiting_draw` |
| Rune place | Any player with cards in hand during `placement_phase`, until that player confirms |
| Placement confirm | Any player during `placement_phase` via `game:confirm_placement_ready`; after confirm, client locks hand/deck and server rejects further place/draw for that player |
| Turn timeouts | Server `tickTurnTimeouts`: auto-roll **10s**, auto-first-move **20s**; client `PhaseCountdownBar` mirrors for active player |

Opponents see board updates from snapshots but not selection arrows, roll button, or your marker card types.

**HUD vs server**

The server does not drive HUD text or layout. Clients derive:

- Finish order from `token_finished` events in snapshot history
- Current turn label from `turn.currentPlayerId` (display delayed after animations)
- Turn banner from local turn ownership + phase (`waiting_choice` vs `waiting_roll` vs rune phases)
- Hand UI from `state.rune.players[localPlayerId]` + `runeView`

There is no socket field for “show move list”; multiple moves are chosen via `game:choose_move` after the player picks a pawn on the board.

## Environment

| Variable | Meaning |
|----------|---------|
| `VITE_API_URL` | API + socket base (e.g. `http://192.168.1.10:3000`). Empty = same origin + Vite proxy. |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |

Place variables in the **repo root** `.env` (see `.env.example`). Vite `envDir` points at the monorepo root so one file serves web and server in local dev.

**Server-only** (same `.env` file, no `VITE_` prefix): `PORT`, `CLIENT_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.

### LAN checklist

1. Server: `0.0.0.0:3000` (default).
2. Web: `pnpm dev --host`.
3. Other device: `http://<host-ip>:5173`.
4. If socket fails cross-origin, set `VITE_API_URL` to `http://<host-ip>:3000`.

## Shared protocol

Extend only via `packages/shared`:

- `src/protocol/events.ts`
- `src/schemas/events.ts`
- `src/types/lobby.ts`, `src/types/game.ts`, `src/types/rune.ts`

Then update [protocol-reference](./protocol-reference.md) and [server socket contract](../../server/docs/socket-contract.md).

## Minimal checklist for new client features

1. Add intent to shared `ClientToServerEvents` + Zod schema.
2. Implement handler in `apps/server/src/socket/handlers.ts`.
3. Add hook method or page handler in `apps/web`.
4. Map snapshot fields in `GameView` / `BoardPieces` if visual.

Avoid socket calls inside Three.js leaf components unless the interaction is purely local.
