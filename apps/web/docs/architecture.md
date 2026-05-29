# Client architecture

## Routes

Defined in `apps/web/src/App.tsx`:

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `HomePage` | Create/join room, public list, matchmaking |
| `/auth/login` | `AuthLoginPage` | Supabase login + guest sign-in |
| `/auth/signup` | `AuthSignupPage` | Supabase registration |
| `/profile/edit` | `ProfileEditPage` | Own profile editor |
| `/profile/:profileId` | `ProfileViewPage` | Public profile view |
| `/lobby/:lobbyId` | `LobbyPage` | Colors, ready, host controls |
| `/game/:gameId` | `OnlineGamePage` | Live multiplayer viewport |
| `/play/local` | `LocalGamePage` | Offline test with same engine as server |

## Layering

```
Pages (Home, Lobby, Online, Local)
    → auth hooks (useAuth, usePlayerIdentity)
    → hooks (useLobbySocket, useGameSocket, usePresentationGameState)
    → GameView (HUD, dev menu, editor controls)
        → BoardScene (Canvas, OrbitControls)
            → BoardModel (static mesh)
            → BoardPieces (pawns, houses, animations)
            → DiceShaker (roll presentation)
```

**Editor** (optional F3 dev menu): `BoardEditor`, `BoardEditorInputHandler`, `BoardEditorVisualization` — local layout state, not sent to server in MVP.

### `BoardScene` (camera)

Gameplay camera is configured in `CAMERA_CONFIG` inside `BoardScene.tsx`:

| Setting | Value (current) | Notes |
|---------|-----------------|--------|
| FOV | 28 | Lower = more zoomed in |
| Orbit distance | 5.0 – 7.2 | Scroll zoom range |
| Default position | ~7.2 from target | Closer default than earlier builds |
| Pan bounds | Clamped X/Y/Z box | `AdaptiveControlsBehavior` enforces limits while playing |

Editor mode unlocks wider orbit distance and disables gameplay pan clamps.

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

Shared shell for local and online: 3D viewport + warm glass HUD overlay + optional dev/editor chrome.

**Props**

| Prop | Role |
|------|------|
| `canRoll` | Page computes: my turn + `waiting_roll` + not presenting dice + game playing |
| `localPlayerId` | Online: restricts move-selection arrows to this client |
| `isPresentingDice` | From `usePresentationGameState`; gates token motion and parts of HUD timing |
| `autoResolveRolled` | Local only: auto-pick sole legal move after dice gate |

Passes `freezeTokenAnimations={isPresentingDice}` to `BoardScene`. Player identity comes from the page layer (`usePlayerIdentity()`), not from `localStorage` directly.

**HUD overlay** (`components/hud/`)

All panels sit in `absolute inset-0 pointer-events-none`; buttons and links use `pointer-events-auto`.

| Component | Position | Behavior |
|-----------|----------|----------|
| `CurrentTurnPanel` | Top-left (below back link) | Whose turn it is; collapsible (SVG chevron). Highlights local player with color ring when `isLocalTurn`. **Display** uses delayed state so the label does not change until dice/token animations finish. |
| `MyPlayerPanel` | Bottom-right | Local client identity (`BẠN`); collapsible. |
| `FinishOrderPanel` | Top-right | Ranked finishers from `token_finished` events; hidden until ≥1 finisher; collapsible. **Display** list is delayed like current-turn panel. |
| `YourTurnBanner` | Center (~30% from top) | Short auto-dismiss (~1s). Shown after presentation completes when it is the local player's turn, or after turn advances to local player. Synced with roll button reveal when applicable. Uses authoritative `gameState.turn.currentPlayerId` for ownership (not delayed HUD state). |
| `RollDiceButton` | Bottom-center | Visible when `canRoll`; hidden immediately on click; returns after presentation + 1s buffer if still allowed to roll. |

Shared helpers: `PlayerBadge`, `playerColorStyles` (static Tailwind color map for `PlayerColor`), `PanelCollapseButton` (SVG chevron, no text labels).

**Move selection**

There is **no** on-screen list of legal moves. When `waiting_choice` with multiple `legalMoves`, `BoardPieces` shows arrows on selectable pawns; click resolves via `onSelectMove`. Online: only tokens belonging to `localPlayerId` are selectable.

**Dev (F3)**

Camera / game debug / editor toggle — separate from gameplay HUD.

## Hooks

### `useLobbySocket(lobbyId, playerId, …)`

Subscribes to `lobby:snapshot` and removal events; emits lobby commands; joins on socket connect.

Does **not** leave on unmount (explicit leave buttons + server disconnect grace only). Uses `retainLobbyOnUnmount` when entering a game.

When a Supabase access token is available, passes it to `lib/socket.ts` for handshake auth.

### `useGameSocket(gameId, playerId)`

Subscribes to `game:state_snapshot`; uses `usePresentationGameState` for display state and dice gate. Blocks `roll` / `chooseMove` while presenting dice.

The hook also accepts the optional Supabase access token so authenticated and anonymous sessions stay aligned with the socket handshake.

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
- `vite.config.ts`: `envDir` → repo root (shared `.env` with server).
- `lib/supabase.ts`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `lib/socket.ts`: `emitLeaveLobby`, `retainLobbyOnUnmount`, `LOBBY_RETAIN_SESSION_KEY`.

## Dev-only features

- **F3** dev menu (camera / game debug / editor toggle)
- Board layout export JSON
- Local roll without server on `/play/local`

Keep these separate from authoritative online state.
