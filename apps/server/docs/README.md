# Server documentation

Backend contract for **Rune Race** — lobby, matchmaking, and authoritative multiplayer gameplay.

## Read first

1. [Overview](./overview.md) — end-to-end flow
2. [Architecture](./architecture.md) — modules and packages
3. [HTTP API](./http-api.md) — REST endpoints
4. [Socket.IO contract](./socket-contract.md) — lobby + game events
5. [Game model](./game-model.md) — rules and state machine
6. [Client integration](./client-integration.md) — what the web client expects

## Runtime

| Service | URL (dev) |
|---------|-----------|
| HTTP + Socket.IO | `http://localhost:3000` |
| WebSocket | `ws://localhost:3000` (default namespace) |

- **Package:** `apps/server`
- **CORS:** `*` (development)
- **Persistence:** in-memory only (MVP; no database)
- **Authority:** server owns lobby and game state; clients send intents only

## Monorepo dependencies

| Package | Role |
|---------|------|
| `@rune-race/shared` | Types, Zod command validation, protocol events |
| `@rune-race/game-engine` | Authoritative rules (`handleRoll`, `handleChooseMove`) |

## Dev commands

```bash
pnpm dev          # web :5173 + server :3000 (from repo root)
pnpm --filter @rune-race/server dev
pnpm --filter @rune-race/game-engine test
```

## LAN / other devices

Server listens on `0.0.0.0:3000`. For clients on another machine, point the web app at the host IP (see [Client integration](./client-integration.md)).
