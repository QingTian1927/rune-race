# Client integration

How the **web app** (`apps/web`) connects to this server today.

## Routes

| Path | Page | Socket / HTTP |
|------|------|----------------|
| `/` | `HomePage` | HTTP rooms + matchmaking |
| `/lobby/:lobbyId` | `LobbyPage` | `lobby:*` |
| `/game/:gameId` | `OnlineGamePage` | `game:*` |
| `/play/local` | `LocalGamePage` | No server (engine only) |

## Client modules

| File | Role |
|------|------|
| `lib/api.ts` | `fetch` wrappers for `/api/rooms`, matchmaking |
| `lib/socket.ts` | Singleton `socket.io-client` |
| `lib/playerSession.ts` | `playerId` + display name in `localStorage` |
| `hooks/useLobbySocket.ts` | Lobby snapshot + commands |
| `hooks/useGameSocket.ts` | Game snapshots + roll/choose |
| `hooks/usePresentationGameState.ts` | Dice animation gate before applying moves |

## Suggested UI states

- `disconnected` / `connecting`
- `lobby` | `countdown` | `in_game` (from `LobbySnapshot.status`)
- `playing` | `finished` (from `GameState.status`)
- `error` (from `lobby:error` / `game:error`)

## Minimal socket sequence (online)

1. `POST /api/rooms` or join via code → navigate to `/lobby/:lobbyId`.
2. Connect socket; `lobby:join` with `playerId`, `playerName`, `lobbyId` or `joinCode`.
3. `lobby:set_color`, `lobby:ready` until countdown → `lobby:game_started`.
4. `sessionStorage.setItem('rune-race-lobby-id', lobbyId)`; navigate to `/game/:gameId`.
5. `game:join`; render from `game:state_snapshot`.
6. On roll snapshot with `dice_roll` in delta: run dice animation (~3s), then apply full state (see web `lib/dicePresentation.ts`).
7. If `waiting_choice` and multiple moves: show arrows **only for `localPlayerId`** (current client).
8. `game:roll` / `game:choose_move` only when it is this player's turn.

## LAN / second device

1. Run server with `host: 0.0.0.0` (default in `index.ts`).
2. Run web with `pnpm dev --host`.
3. Other device: open `http://<host-lan-ip>:5173`.
4. Optional: set `VITE_API_URL=http://<host-lan-ip>:3000` if not using Vite proxy.

**Note:** `crypto.randomUUID` requires HTTPS or localhost. The client falls back to `getRandomValues` on plain HTTP LAN (see `playerSession.ts`).

## Reconnect

- Lobby: `lobby:sync_request`
- Game: `game:sync_request` (uses socket `gameId` or player index)

## What not to do

- Do not treat client-derived legal moves as truth online.
- Do not animate token moves from full `events` history on every snapshot — use delta + `tokenMotion.ts` version cursor.
- Do not show opponent move-selection arrows to all clients — pass `localPlayerId` into `GameView`.

## Related web docs

- [Web architecture](../../web/docs/architecture.md)
- [Backend integration (web)](../../web/docs/backend-integration.md)
