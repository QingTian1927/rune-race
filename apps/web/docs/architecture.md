# Client architecture

## Routes

Defined in `apps/web/src/App.tsx`:

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `LandingPage` | Marketing landing (static) |
| `/play` | `PlayPage` | Create/join room, public list, matchmaking hub |
| `/guide` | `GuidePage` | Static gameplay / rune guide |
| `/auth/login` | `AuthLoginPage` | Supabase login + guest sign-in |
| `/auth/signup` | `AuthSignupPage` | Supabase registration |
| `/profile/edit` | `ProfileEditPage` | Own profile editor |
| `/profile/:profileId` | `ProfileViewPage` | Public profile view |
| `/shop` | `ShopPage` | Coin shop for house skins (3D preview) |
| `/lobby/:lobbyId` | `LobbyPage` | Colors, ready, host controls |
| `/game/:gameId` | `OnlineGamePage` | Live multiplayer viewport |

## Layering

```
App (all routes)
    → useUiSoundEffects() — delegated UI click / hover SFX

Pages (Play, Lobby, Online, Shop, Profile)
    → auth hooks (useAuth, usePlayerIdentity, usePlayerProfile)
    → hooks (useLobbySocket, useGameSocket, useRoomChat, usePresentationGameState, usePlayerHouseSkins)
    → GameView (HUD, rune layer, dev menu, editor controls)
        → BoardScene (Canvas, OrbitControls)
            → BoardModel (static mesh)
            → BoardPieces (pawns, HouseModel homes, animations)
            → RuneMarkers / RunePlacementLayer (when runes enabled)
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

- Positions tokens from `GameState` (`in_base`, `on_track`, `in_home_lane`, `finished`). Stable uses a **2×2** slot grid (supports classic 4 horses; rune mode uses two slots).
- **Color slot:** `boardSlotForPlayer()` maps player color → board slot (fixes pawn/house colors vs player order).
- **Homes:** `HouseModel` renders each player's **home** tile from `houseSkinsByPlayerId` (equipped skin from server). Procedural placeholders per tier until GLB assets are added (`hasGlbAsset` in `HOUSE_CATALOG`). Bots use `house_default`.
- **Motion:** `tokenMotion.ts` — animates only **delta** events since last `version`; `freezeTokenAnimations` during dice presentation.
- **Selection:** arrows + click handler when `selectableTokenIds` is non-empty.
- **Impacts:** `ImpactPuffPool` on step land / spawn / capture; `onImpact` drives walk and kill SFX (see [Audio](./audio.md)).

### `DiceShaker`

Phases: `appearing → shaking → lifting → revealing → finished`. Timings from `lib/dicePresentation.ts` (bucket hold **1s** after reveal).

**SFX (client):** `game.diceShake` on entering **shaking**; `game.jackpot` on entering **revealing** when the roll is **6**. See [Audio](./audio.md).

### `GameView`

Shared shell for local and online: 3D viewport + warm glass HUD overlay + optional dev/editor chrome.

**Props**

| Prop | Role |
|------|------|
| `canRoll` | Page computes: my turn + (`waiting_roll` \| `leave_stable_phase`) + not presenting dice + game playing |
| `localPlayerId` | Online: restricts move-selection arrows to this client |
| `isPresentingDice` | From `usePresentationGameState`; gates token motion and parts of HUD timing |
| `autoResolveRolled` | Local only: auto-pick sole legal move after dice gate |
| `runeView` | Per-client marker tooltips from snapshot (`RuneClientView`) |
| `onDrawCards` / `onPlaceMarker` / `onConfirmPlacementReady` / `onUseLeaveStable` / `onChooseSwap` | Online rune intents via `useGameSocket` |
| `roomChat` | Optional `RoomChatPanel` slot (online) |
| `backHref` | Exit destination after game (lobby id or `/play`) |
| `onLeave` | Online: `lobby:leave` + navigate to `/play` |

Passes `freezeTokenAnimations={isPresentingDice}` and `houseSkinsByPlayerId` from `usePlayerHouseSkins` into `BoardScene`. Player identity comes from the page layer (`usePlayerIdentity()`), not from `localStorage` directly.

See [Rune system (client)](./rune-system.md) for hand/placement/swap behavior.

**HUD overlay** (`components/hud/`)

All panels sit in `absolute inset-0 pointer-events-none`; buttons and links use `pointer-events-auto`.

| Component | Position | Behavior |
|-----------|----------|----------|
| `CurrentTurnPanel` | Top-left (below back link) | Whose turn it is; collapsible (SVG chevron). Highlights local player with color ring when `isLocalTurn`. **Display** uses delayed state so the label does not change until dice/token animations finish. |
| `MyPlayerPanel` | Bottom-right | Local client identity (`BẠN`); collapsible. |
| `FinishOrderPanel` | Top-right | Ranked finishers from `token_finished` events; hidden until ≥1 finisher; collapsible. **Display** list is delayed like current-turn panel. |
| `YourTurnBanner` | Center (~30% from top) | Short auto-dismiss (~1s). Shown after presentation completes when it is the local player's turn, or after turn advances to local player. Synced with roll button reveal when applicable. Uses authoritative `gameState.turn.currentPlayerId` for ownership (not delayed HUD state). |
| `RollDiceButton` | Bottom-center | Visible when `canRoll` (`waiting_roll` or `leave_stable_phase` only); hidden during `placement_phase` and `waiting_draw`; hidden immediately on click; returns after presentation + 1s buffer if still allowed to roll. |
| `HandArrayPanel` | Bottom-left | Rune hand (max 5), draw button on active player's turn; greyed `LEAVE_STABLE` when spawn impossible; see [rune-system](./rune-system.md) |
| `PhaseCountdownBar` | Bottom-center (hint slot) | Placement / roll / move-choice countdown with progress bar |
| `RuneCardPreviewOverlay` | Center overlay | Card preview and placement confirm |
| `GameSettingsOverlay` | Settings gear | Graphics quality, master volume, fullscreen, landscape hint |
| `GameEndOverlay` | Center | Rankings + countdown when `status === 'finished'` |
| `LandscapeHintOverlay` | Full screen | Suggests landscape on small portrait viewports |

Shared helpers: `PlayerBadge`, `playerColorStyles` (static Tailwind color map for `PlayerColor`), `PanelCollapseButton` (SVG chevron, no text labels).

**Move selection**

There is **no** on-screen list of legal moves. When `waiting_choice` with multiple `legalMoves`, `BoardPieces` shows arrows on selectable pawns; click resolves via `onSelectMove`. Online: only tokens belonging to `localPlayerId` are selectable.

When `waiting_swap_choice`, selection mode is `swap`: pick a valid target token for `onChooseSwap` (see [rune-system](./rune-system.md)).

**Dev (F3)**

Camera / game debug / editor toggle — separate from gameplay HUD.

### `ShopPage`

Coin shop at `/shop` (sky layout). Master-detail catalog with `HousePreviewCanvas` (R3F) for color swatches. Calls `fetchShopCatalog`, `fetchShopInventory`, `purchaseHouse`, `equipHouse`. Back link goes to `/play`. Styles scoped under `.shop-form-stage` in `rune-race-sky.css`.

### `HouseModel` / `proceduralHouses`

`components/houses/HouseModel.tsx` picks GLB (`houseLoader.ts`) or procedural tier mesh from `skinId` + `PlayerColor`. Only the **home** zone on the board is customized (not stable).

## Hooks

### `useLobbySocket(lobbyId, playerId, …)`

Subscribes to `lobby:snapshot` and removal events; emits lobby commands; joins on socket connect.

Does **not** leave on unmount (explicit leave buttons + server disconnect grace only). Uses `retainLobbyOnUnmount` when entering a game.

When a Supabase access token is available, passes it to `lib/socket.ts` for handshake auth.

### `useGameSocket(gameId, playerId, authToken?, lobbyPresence?)`

Subscribes to `game:state_snapshot` (`ClientGameSnapshot` with `runeView`); uses `usePresentationGameState` for display state and dice gate. Blocks `roll` / `chooseMove` while presenting dice.

Exposes rune intents: `drawCards`, `finishDraw`, `placeMarker`, `chooseSwap`.

Re-emits `lobby:join` when `lobbyPresence` is set so the client stays in the lobby room while in `/game/:gameId` (chat + removal events).

The hook also accepts the optional Supabase access token so authenticated and anonymous sessions stay aligned with the socket handshake.

### `useRoomChat(lobbyId, playerId, authToken?)`

Lobby-scoped chat: `chat:sync_request` on connect, listens for `chat:history` / `chat:message`, emits `chat:send`.

### `usePresentationGameState`

When delta contains `dice_roll` and `version` advanced:

1. Show gated state (frozen tokens, no legal moves).
2. After `DICE_ANIMATION_TOTAL_MS` (~2960ms), apply pending authoritative state.

Skips dice gate on **first** snapshot (full event history on join).

### `useBoardImpactFeedback`

Default feedback for `GameView` / `BoardScene`: impact puff visibility follows graphics quality; `onImpact` plays **walk** / **kill** SFX via `audioManager` (see [Audio](./audio.md)).

### `useUiSoundEffects`

Mounted in `App.tsx`. Global UI click and hover sounds on all routes; respects master volume from `localStorage`.

### `usePlayerHouseSkins`

Loads equipped house skin per player id via `GET /api/players/:id/cosmetics`. Merges the local player's equipped id from `usePlayerProfile` to avoid a stale fetch. Bots always get `house_default`.

### `useAudioSettings`

Reads/writes `rune-race-audio-volume`; wired into `GameSettingsOverlay` from `GameView`.

## Shared packages

| Package | Client usage |
|---------|----------------|
| `@rune-race/shared` | Types, socket event typings, Zod, `HOUSE_CATALOG`, cosmetics helpers |
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
- Engine-only rules testing via `@rune-race/game-engine` (no dedicated route in `App.tsx`)

Keep these separate from authoritative online state.
