# Client architecture

## Routes

Defined in `apps/web/src/App.tsx`:

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `HomePage` | Create/join room, public list, matchmaking |
| `/lobby/:lobbyId` | `LobbyPage` | Colors, ready, host controls |
| `/game/:gameId` | `OnlineGamePage` | Live multiplayer viewport |
| `/play/local` | `LocalGamePage` | Offline test with same engine as server |

## Layering

```
Pages (Home, Lobby, Online, Local)
    → hooks (useLobbySocket, useGameSocket, usePresentationGameState)
    → GameView (HUD, dev menu, editor controls)
        → BoardScene (Canvas, OrbitControls)
            → BoardModel (static mesh)
            → BoardPieces (pawns, houses, animations)
            → DiceShaker (roll presentation)
```

**Editor** (optional F3 / panel): `BoardEditor`, `BoardEditorInputHandler`, `BoardEditorVisualization` — local layout state, not sent to server in MVP.

## Rendering components

### `BoardModel`

Static board geometry and track markers.

### `BoardPieces`

- Positions tokens from `GameState` (`in_base`, `on_track`, `in_home_lane`, `finished`).
- **Color slot:** `boardSlotForPlayer()` maps player color → board slot (fixes pawn/house colors vs player order).
- **Motion:** `tokenMotion.ts` — animates only **delta** events since last `version`; `freezeTokenAnimations` during dice presentation.
- **Selection:** arrows + click handler when `selectableTokenIds` is non-empty.

### `DiceShaker`

Phases: `appearing → shaking → lifting → revealing → finished`. Timings from `lib/dicePresentation.ts` (bucket hold **1s** after reveal).

### `GameView`

Shared shell for local and online:

- Roll button, phase/dice HUD, finish-order list
- Props: `canRoll`, `localPlayerId`, `isPresentingDice`, `autoResolveRolled` (local only)
- Passes `freezeTokenAnimations={isPresentingDice}` to `BoardScene`

## Hooks

### `useLobbySocket(lobbyId, playerId)`

Subscribes to `lobby:snapshot`, emits lobby commands. Handles join on connect.

### `useGameSocket(gameId, playerId)`

Subscribes to `game:state_snapshot`; uses `usePresentationGameState` for display state and dice gate. Blocks `roll` / `chooseMove` while presenting dice.

### `usePresentationGameState`

When delta contains `dice_roll` and `version` advanced:

1. Show gated state (frozen tokens, no legal moves).
2. After `DICE_ANIMATION_TOTAL_MS` (~2960ms), apply pending authoritative state.

Skips dice gate on **first** snapshot (full event history on join).

## Shared packages

| Package | Client usage |
|---------|----------------|
| `@rune-race/shared` | Types, socket event typings, Zod |
| `@rune-race/game-engine` | Local game + same rules as server |

## Configuration

- `config.ts`: `API_BASE = import.meta.env.VITE_API_URL ?? ''`
- Empty `API_BASE` → same-origin; Vite proxies `/api` and `/socket.io` to port 3000.

## Dev-only features

- **F3** dev menu (camera / game debug / editor toggle)
- Board layout export JSON
- Local roll without server on `/play/local`

Keep these separate from authoritative online state.
