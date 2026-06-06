# Overview

Rune Race uses a **server-authoritative** model: lobbies for match setup, then a separate **game session** with per-client snapshots over Socket.IO.

## High-level flow

1. Client opens Socket.IO to the server (same origin or proxied `/socket.io`); optional Supabase token in handshake.
2. **Lobby:** client emits `lobby:join` (by `lobbyId` or `joinCode`), receives `lobby:snapshot`.
3. Players pick **color**, toggle **ready**. Host may toggle **runesEnabled**. When all ready → **5s countdown** → game starts.
4. Server emits `lobby:game_started` with `gameId`; clients navigate to `/game/:gameId` and emit `game:join`.
5. **Rune gameplay (when enabled):** draw cards → simultaneous placement → roll → move with stepwise marker triggers; see [Rune system](./rune-system.md).
6. **Classic flow:** `game:roll` and `game:choose_move`; each accepted action broadcasts `game:state_snapshot`.
7. **Chat:** lobby-scoped messages via `chat:*` (persisted in memory for the room lifetime).
8. **Auth/profile:** Supabase email/password, Google, or anonymous auth. Profile data in Supabase; public profiles viewable by id.
9. Game ends when `status === 'finished'`; lobby resets for a new match.

## HTTP vs Socket

| Concern | HTTP | Socket |
|---------|------|--------|
| List/create rooms | `GET/POST /api/rooms` | — |
| Room by id / join code | `GET /api/rooms/:lobbyId`, `by-code/:joinCode` | — |
| Matchmaking queue | `POST/GET/DELETE /api/matchmaking/*` | — |
| Feature flags | `GET /api/public/feature-flags` | — |
| Auth/profile | `GET/PATCH /api/profile`, `GET /api/profile/:id`, `POST /api/auth/link-anon`, `PATCH /api/player/display-name` | `auth` token in handshake |
| Lobby state & ready | — | `lobby:*` |
| Chat | — | `chat:*` |
| Gameplay + runes | — | `game:*` |

## Important rules

- **2–4 players** per game.
- **Spawn** only on dice **1** or **6** (see [Game model](./game-model.md)).
- **Extra turn** when the active player rolls **6** (after resolving the move); bonus turns skip rune draw/placement.
- **Single legal move** after roll: server auto-resolves in one snapshot.
- **Multiple legal moves:** turn stays in `waiting_choice` until `game:choose_move`.
- **Runes:** host can disable via lobby setting; when enabled, normal turns include draw + placement before roll.
- **Finish:** a player is ranked when all 4 tokens are in the final zone (`in_home_lane` or `finished`).
- **Game end:** when **all but one** player have finished (`finishedCount >= playerCount - 1`).
- **Auth:** when present, the socket handshake token is verified against Supabase and used to bind the socket to that user id.
- Clients must **not** mutate authoritative state; use snapshots + delta `events` for animation only.
- **Marker secrets:** server strips `cardType` / `realPlacerId` from broadcast state; per-viewer `runeView` exposes only the viewer's own markers.
- **Client HUD** (turn panels, banners, roll button, hand UI) is derived locally; see [Client integration](./client-integration.md#client-hud-reference).

## Shared contracts

Import from `@rune-race/shared`:

- `ClientToServerEvents`, `ServerToClientEvents`
- `LobbySnapshot`, `GameState`, `ClientGameSnapshot`, `GameEvent`, `LegalMove`, `Turn`
- `RuneGameState`, `RuneClientView`, `RUNE_CARD_DEFINITIONS`
- `validateCommand` (Zod per event name)
- Lobby constants: `LOBBY_START_COUNTDOWN_SECONDS`, `MATCHMAKING_TIER_*`, etc.

## Health

- `GET /` — status message
- `GET /health` — `{ status, timestamp }`
