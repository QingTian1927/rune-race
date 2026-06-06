# Web client documentation

Vite + React + TypeScript client for **Rune Race** — 3D board, lobby, rune cards, chat, and online multiplayer.

## Read first

1. [Architecture](./architecture.md) — routes, components, hooks
2. [Runtime flow](./runtime-flow.md) — boot, local vs online, dice presentation, rune turns
3. [Rune system (client)](./rune-system.md) — hand, placement, markers, swap UI
4. [Backend integration](./backend-integration.md) — API, socket, LAN dev
5. [Protocol reference](./protocol-reference.md) — event list (mirrors `@rune-race/shared`)
6. [Editor data model](./editor-data-model.md) — board layout JSON

## Scope

| Mode | Route | Authority |
|------|-------|-----------|
| Home / rooms | `/` | HTTP + socket lobby |
| Guide | `/guide` | Static rules page |
| Lobby | `/lobby/:lobbyId` | Server `lobby:snapshot` |
| Online game | `/game/:gameId` | Server `game:state_snapshot` + `runeView` |
| Local test | `/play/local` | `@rune-race/game-engine` (same rules as server) |

## Stack

- **3D:** React Three Fiber, drei, Three.js
- **Rules:** `@rune-race/game-engine` (re-exported from `mock/mockGameEngine.ts`)
- **Protocol:** `@rune-race/shared`
- **Auth:** Supabase (email, Google, anonymous)
- **Dev proxy:** `/api` and `/socket.io` → `localhost:3000` (`vite.config.ts`)

## Rendering capabilities

- 3D board, houses, pawns with path animation
- **Rune layer:** hand array, 3D map pins, placement picking, card preview, impersonation picker
- **Gameplay HUD** (warm glass-style overlay): current turn, local player, finish order, turn banner, roll button — see [Architecture → GameView](./architecture.md#gameview)
- **Lobby chat** in-game via `RoomChatPanel` + `useRoomChat`
- Move selection: camera-facing arrows on pawns only (**no** move list UI); online restricts selection to **local player**
- Dice shaker (bucket + die) with presentation gate before token moves
- HUD profile panels delayed until dice/token animations complete
- Board editor (layout JSON export)
- Graphics quality + landscape hint + fullscreen in settings overlay

## Server docs

- [Server index](../../server/docs/index.md)
- [Client integration (server view)](../../server/docs/client-integration.md)
- [Rune system (server)](../../server/docs/rune-system.md)

## Key source files

```
apps/web/src/
├── App.tsx                 # Routes
├── pages/
│   ├── HomePage.tsx        # Rooms + matchmaking
│   ├── LobbyPage.tsx       # Ready, host settings (incl. runesEnabled)
│   ├── OnlineGamePage.tsx
│   ├── LocalGamePage.tsx
│   └── GuidePage.tsx
├── components/
│   ├── GameView.tsx        # HUD shell + rune + presentation timing
│   ├── hud/                # HandArrayPanel, CurrentTurnPanel, …
│   ├── board/              # RuneMarkers, RunePlacementLayer
│   ├── chat/RoomChatPanel.tsx
│   ├── BoardPieces.tsx
│   └── DiceShaker.tsx
├── scenes/
│   └── BoardScene.tsx      # Canvas, camera, OrbitControls
├── hooks/
│   ├── useLobbySocket.ts
│   ├── useGameSocket.ts
│   ├── useRoomChat.ts
│   └── usePresentationGameState.ts
└── lib/
    ├── api.ts, socket.ts, playerSession.ts, supabase.ts
    ├── dicePresentation.ts, tokenMotion.ts, runeAssets.ts
    └── utils/boardSlots.ts
```

## Dev

```bash
pnpm dev              # web :5173 + server :3000
pnpm dev --host       # expose Vite on LAN
```
