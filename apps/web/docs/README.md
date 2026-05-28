# Web client documentation

Vite + React + TypeScript client for **Rune Race** — 3D board, lobby, profile/auth, and online multiplayer.

## Read first

1. [Architecture](./architecture.md) — routes, components, hooks
2. [Runtime flow](./runtime-flow.md) — boot, local vs online, dice presentation
3. [Backend integration](./backend-integration.md) — API, socket, LAN dev
4. [Protocol reference](./protocol-reference.md) — event list (mirrors `@rune-race/shared`)
5. [Editor data model](./editor-data-model.md) — board layout JSON

## Scope

| Mode | Route | Authority |
|------|-------|-----------|
| Home / rooms | `/` | HTTP + socket lobby |
| Auth | `/auth/login`, `/auth/signup` | Supabase sessions |
| Profile | `/profile/:profileId`, `/profile/edit` | Supabase profile API |
| Lobby | `/lobby/:lobbyId` | Server `lobby:snapshot` |
| Online game | `/game/:gameId` | Server `game:state_snapshot` |
| Local test | `/play/local` | `@rune-race/game-engine` (same rules as server) |

## Stack

- **3D:** React Three Fiber, drei, Three.js
- **Auth:** Supabase client + anonymous/email/password/Google sessions
- **Rules:** `@rune-race/game-engine` (re-exported from `mock/mockGameEngine.ts`)
- **Protocol:** `@rune-race/shared`
- **Dev proxy:** `/api` and `/socket.io` → `localhost:3000` (`vite.config.ts`)

## Rendering capabilities

- 3D board, houses, pawns with path animation
- **Gameplay HUD** (warm glass-style overlay): current turn, local player, finish order, turn banner, roll button — see [Architecture → GameView](./architecture.md#gameview)
- Move selection: camera-facing arrows on pawns only (**no** move list UI); online restricts selection to **local player**
- Dice shaker (bucket + die) with presentation gate before token moves
- HUD profile panels delayed until dice/token animations complete
- Board editor (layout JSON export)
- Profile pages with public view and owner-only edit
- Anonymous sign-in flow with guest profile support

## Server docs

- [Server index](../../server/docs/index.md)
- [Client integration (server view)](../../server/docs/client-integration.md)

## Key source files

```
apps/web/src/
├── App.tsx                 # Routes
├── pages/
│   ├── HomePage.tsx        # Rooms + matchmaking
│   ├── LobbyPage.tsx
│   ├── OnlineGamePage.tsx
│   └── LocalGamePage.tsx
├── components/
│   ├── GameView.tsx        # HUD shell + presentation timing
│   ├── hud/                # CurrentTurnPanel, MyPlayerPanel, FinishOrderPanel, …
│   ├── BoardPieces.tsx
│   └── DiceShaker.tsx
├── scenes/
│   └── BoardScene.tsx      # Canvas, camera, OrbitControls
├── hooks/
│   ├── useLobbySocket.ts
│   ├── useGameSocket.ts
│   └── usePresentationGameState.ts
└── lib/
    ├── api.ts, socket.ts, playerSession.ts
    ├── dicePresentation.ts, tokenMotion.ts
    └── utils/boardSlots.ts
```

## Dev

```bash
pnpm dev              # web :5173 + server :3000
pnpm dev --host       # expose Vite on LAN
```
