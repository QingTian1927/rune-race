# Overview

Rune Race uses a **server-authoritative** model: lobbies for match setup, then a separate **game session** with snapshots over Socket.IO.

## High-level flow

1. Client opens Socket.IO to the server (same origin or proxied `/socket.io`).
2. **Lobby:** client emits `lobby:join` (by `lobbyId` or `joinCode`), receives `lobby:snapshot`.
3. Players pick **color**, toggle **ready**. When all ready → **5s countdown** → game starts.
4. Server emits `lobby:game_started` with `gameId`; clients navigate to `/game/:gameId` and emit `game:join`.
5. **Gameplay:** `game:roll` and `game:choose_move`; each accepted action broadcasts `game:state_snapshot`.
6. Game ends when `status === 'finished'`; lobby resets for a new match.

## HTTP vs Socket

| Concern | HTTP | Socket |
|---------|------|--------|
| List/create rooms | `GET/POST /api/rooms` | — |
| Resolve join code | `GET /api/rooms/by-code/:joinCode` | — |
| Matchmaking queue | `POST/GET/DELETE /api/matchmaking/*` | — |
| Lobby state & ready | — | `lobby:*` |
| Gameplay | — | `game:*` |

## Important rules

- **2–4 players** per game.
- **Spawn** only on dice **1** or **6** (see [Game model](./game-model.md)).
- **Extra turn** when the active player rolls **6** (after resolving the move).
- **Single legal move** after roll: server auto-resolves in one snapshot.
- **Multiple legal moves:** turn stays in `waiting_choice` until `game:choose_move`.
- **Finish:** a player is ranked when all 4 tokens are in the final zone (`in_home_lane` or `finished`).
- **Game end:** when **all but one** player have finished (`finishedCount >= playerCount - 1`). The last player does not need to keep playing.
- Clients must **not** mutate authoritative state; use snapshots + delta `events` for animation only.

## Shared contracts

Import from `@rune-race/shared`:

- `ClientToServerEvents`, `ServerToClientEvents`
- `LobbySnapshot`, `GameState`, `GameEvent`, `LegalMove`, `Turn`
- `validateCommand` (Zod per event name)
- Lobby constants: `LOBBY_START_COUNTDOWN_SECONDS`, `MATCHMAKING_TIER_*`, etc.

## Health

- `GET /` — status message
- `GET /health` — `{ status, timestamp }`
