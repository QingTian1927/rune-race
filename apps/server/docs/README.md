# Server documentation

Backend contract for **Rune Race** — lobby, matchmaking, Supabase auth/profile, coin shop (house cosmetics), lobby chat, rune gameplay, and authoritative multiplayer.

## Read first

1. [Overview](./overview.md) — end-to-end flow
2. [Architecture](./architecture.md) — modules and packages
3. [HTTP API](./http-api.md) — REST endpoints
4. [Socket.IO contract](./socket-contract.md) — lobby + game + chat events
5. [Game model](./game-model.md) — rules and state machine
6. [Rune system](./rune-system.md) — draw, placement, markers, per-client views
7. [Client integration](./client-integration.md) — what the web client expects (incl. client-only HUD and audio)

## Runtime

| Service | URL (dev) |
|---------|-----------|
| HTTP + Socket.IO | `http://localhost:3000` |
| WebSocket | `ws://localhost:3000` (default namespace) |

- **Package:** `apps/server`
- **CORS:** configurable via `CLIENT_ORIGIN` (defaults permissive in development)
- **Persistence:** lobby/game/chat state is in-memory; user profiles, coins, and house cosmetics live in Supabase
- **Authority:** server owns lobby and game state; clients send intents only

## Monorepo dependencies

| Package | Role |
|---------|------|
| `@rune-race/shared` | Types, Zod command validation, protocol events, `buildClientGameSnapshot` |
| `@rune-race/game-engine` | Authoritative rules (`handleRoll`, rune commands, stepwise movement) |

## Dev commands

```bash
pnpm dev          # web :5173 + server :3000 (from repo root)
pnpm --filter @rune-race/server dev
pnpm --filter @rune-race/game-engine test
```

## LAN / other devices

Server listens on `0.0.0.0:3000`. For clients on another machine, point the web app at the host IP (see [Client integration](./client-integration.md)).
