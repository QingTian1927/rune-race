# Protocol reference

Authoritative definitions: `packages/shared/src/protocol/events.ts` and `packages/shared/src/schemas/events.ts`.

Server details: [Socket contract](../../server/docs/socket-contract.md).

## Client → server

### Lobby

| Event | When |
|-------|------|
| `lobby:join` | Enter room (`lobbyId` and/or `joinCode`, optional `password`) |
| `lobby:set_color` | Pick seat color |
| `lobby:ready` / `lobby:unready` | Toggle ready |
| `lobby:leave` | Leave lobby |
| `lobby:kick` | Host removes player |
| `lobby:cancel_countdown` | Host stops auto-start timer |
| `lobby:update_settings` | Host renames room / password / `runesEnabled` |
| `lobby:transfer_host` | Host transfer |
| `lobby:sync_request` | Resync snapshot after reconnect |

### Chat (lobby-scoped)

| Event | When |
|-------|------|
| `chat:send` | Send message `{ playerId, lobbyId, text }` |
| `chat:sync_request` | Request history after connect |

### Game

| Event | When |
|-------|------|
| `game:join` | Enter match (`gameId` from `lobby:game_started`) |
| `game:draw_cards` | Your turn, phase `waiting_draw` or `placement_phase` |
| `game:finish_draw` | Your turn, phase `waiting_draw` — open placement window |
| `game:place_marker` | Phase `placement_phase` — place held card on shared track |
| `game:roll` | Your turn — closes rune window if needed, then rolls when `waiting_roll` |
| `game:choose_move` | Phase `waiting_choice`; `moveId` from snapshot |
| `game:choose_swap` | Phase `waiting_swap_choice`; target token for SWAP marker |
| `game:sync_request` | Resync full game state |
| `game:ping` | Optional heartbeat (no-op on server) |

## Server → client

### Lobby

| Event | Payload |
|-------|---------|
| `lobby:connected` | `{ playerId, lobbyId }` |
| `lobby:host_secrets` | `{ roomPassword }` — **host only**, for settings UI |
| `lobby:snapshot` | `LobbySnapshot` |
| `lobby:start_countdown` | `{ seconds }` |
| `lobby:start_countdown_cancelled` | `{ reason }` |
| `lobby:game_started` | `{ gameId, lobbyId, firstPlayerId }` |
| `lobby:error` | `{ message, code }` |
| `lobby:closed` | `{ lobbyId, reason: 'empty' }` |
| `lobby:kicked` | `{ lobbyId, reason: 'kicked' }` |
| `lobby:removed` | `{ lobbyId, reason: 'left' \| 'disconnect_timeout' }` |

### Chat

| Event | Payload |
|-------|---------|
| `chat:history` | `{ lobbyId, messages: ChatMessage[] }` |
| `chat:message` | `ChatMessage` (user or system) |
| `chat:error` | `{ message, code }` |

### Game

| Event | Payload |
|-------|---------|
| `game:connected` | `{ playerId, gameId }` |
| `game:state_snapshot` | `ClientGameSnapshot` — `{ version, state, events, runeView }` |
| `game:error` | `{ message, code }` |
| `game:turn_timeout_warning` | Not emitted in MVP |

## Client handling rules

1. **Replace** local game assumptions on each snapshot (version monotonic).
2. Use **`events` delta** for animations; do not replay entire `state.events` every frame.
3. On **`dice_roll` in delta**, run presentation gate before showing moves / animating tokens.
4. **Legal moves** — render from `state.turn.legalMoves` only; never sole client-side derivation online.
5. **Rune secrets** — use `runeView.myMarkers` for your card types; never infer opponent marker types from `state.rune.markers`.
6. **Reconnect** — `lobby:sync_request` / `game:sync_request` / `chat:sync_request` immediately.

## Deprecated names (removed)

Do not implement these in new clients:

- `game:room_snapshot` → `lobby:snapshot`
- `game:start` → lobby ready + countdown
- `game:join` with `roomId` + `color` at lobby time → split into `lobby:join` + `game:join`

## Versioning

When changing payloads:

1. Update Zod schemas in `@rune-race/shared`.
2. Update server handlers and client hooks.
3. Update this file and `apps/server/docs/socket-contract.md`.
