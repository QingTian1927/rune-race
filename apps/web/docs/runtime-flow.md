# Runtime flow

## Boot

1. `main.tsx` → `App` router.
2. `AuthProvider` restores the Supabase session and guest id.
3. `HomePage` uses `usePlayerIdentity()` to derive the active player id and display name.
4. User creates/joins room → `/lobby/:lobbyId` or matchmaking → lobby.

## Lobby flow (`LobbyPage`)

1. `useLobbySocket` connects; emits `lobby:join` (password from router state if any).
2. UI renders `LobbySnapshot`: players, colors, ready, countdown.
3. Host: kick, settings, cancel countdown, transfer host.
4. All ready → server countdown 5s → `lobby:game_started`.
5. Navigate to `/game/:gameId`; `retainLobbyOnUnmount` keeps lobby membership; `sessionStorage` stores `rune-race-lobby-id` for Back.

**Leaving:** use **Rời phòng** or **← Trang chủ** (both emit `lobby:leave`). Accidental tab close → server disconnect grace (30s) then removal.

## Online game flow (`OnlineGamePage`)

1. `useGameSocket(gameId, playerId, accessToken, lobbyPresence)` → `game:join` on connect; re-joins lobby for chat/removal.
2. **Back** → `/lobby/:lobbyId` (still a lobby member).
3. **Rời game** → `lobby:leave` + navigate home (forfeit + leave lobby).
4. Listens for `lobby:closed` / `lobby:kicked` / `lobby:removed` to redirect if removed while in match.
5. `GameView` receives display state from presentation hook + `runeView` for marker tooltips.
6. **Rune turn (when enabled):** active player may draw cards; all players with hand cards may place during `placement_phase`; roll button closes draw/placement then rolls — see [Rune system](./rune-system.md).
7. **Roll:** if `canRoll` → `game:roll`.
8. Server snapshot with delta `dice_roll` (+ maybe `token_moved` / `token_stepped` if auto-resolved):
   - Increment `rollTrigger` → `DiceShaker` animates.
   - Tokens frozen until animation completes.
9. **Choice:** if `waiting_choice` and multiple moves and `localPlayerId === currentPlayerId` → arrows on **my** pawns only → `game:choose_move`.
10. **Swap:** if `waiting_swap_choice` → pick target pawn → `game:choose_swap`.
11. **Finished:** `GameState.status === 'finished'`; finish-order HUD updates after token animations (see [HUD timing](#hud-timing)).
12. **Chat:** `RoomChatPanel` via `useRoomChat` (same lobby id in `sessionStorage`).

## Local game flow (`LocalGamePage`)

1. Initial state from `getMockSnapshot()`.
2. `usePresentationGameState` + `rollMockTurn` / `resolveMockTurn` (engine).
3. `autoResolveRolled` on `GameView` resolves single-move turns after presentation gate opens.
4. No `localPlayerId` restriction on arrows (single tester controls all seats).

## Dice presentation timeline

From `dicePresentation.ts`:

| Phase | Duration |
|-------|----------|
| appearing | 0.22s |
| shaking | 1.1s |
| lifting | 0.42s |
| revealing | 0.22s |
| bucket hold | 1.0s |
| **Total gate** | ~2.96s |

After gate: apply full snapshot; `BoardPieces` processes delta `token_moved` / `token_captured`.

## Token animation

- `getDeltaEventsSinceVersion` — only new events when `version` bumps.
- First snapshot after join: skip replaying full history.
- During `freezeTokenAnimations`: do not advance version cursor or animate.
- With runes enabled, movement may emit `token_stepped` per cell (marker triggers) before final `token_moved`.

## Game rules (display / testing)

Aligned with `@rune-race/game-engine`:

- Spawn on **1** or **6**
- Extra turn on **6**
- Finish rank when all tokens in final zone
- Game ends when **all but one** player have finished
- Finished players skipped in turn order

## HUD timing

The HUD separates **authoritative** game state (rolls, banners, `canRoll`) from **displayed** profile panels (current turn, finish order).

### Authoritative (immediate)

- `isMyTurn` for banner eligibility uses `gameState.turn.currentPlayerId === localPlayer.id`.
- Roll button hides as soon as the player clicks roll.
- `isPresentingDice` blocks roll/choose emits via `useGameSocket`.

### Delayed display (current turn + finish order)

`GameView` keeps `displayedTurnPlayerId` and `displayedFinishOrderIds`:

1. On snapshot version bump, inspect **delta** events (same cursor pattern as `tokenMotion.ts`).
2. While `isPresentingDice` is true (dice shaker gate), **do not** update these panels.
3. If delta includes `token_moved` / `token_captured`, wait ~`pathLength × 300ms` (+ capture buffer) then commit UI.
4. Otherwise commit immediately.

This prevents the “current turn” chip and finish list from jumping ahead of pawn animations.

### Banner + roll button after roll

Rough sequence when the local player rolls:

1. Click roll → roll button hidden.
2. `isPresentingDice` true → dice animation (~2.96s); tokens frozen.
3. Full snapshot applied → token motion runs from delta.
4. If still local turn: `YourTurnBanner` may show (e.g. `HÃY CHỌN NƯỚC ĐI` when multiple legal moves, or `ĐẾN LƯỢT CỦA BẠN` when turn starts).
5. After presentation, roll button can reappear after a **1s** buffer if `canRoll` is still true.

When turn advances to the local player via `turn_advanced`, banner timing waits for the last move animation duration before showing.

## Camera / editor

- Default: `OrbitControls` on gameplay viewport; FOV **28**, orbit distance **5.0–7.2** (see `BoardScene` `CAMERA_CONFIG`).
- Editor active + mouse mode `draw`: controls locked for layout editing.
- Editor data loaded from `data/board-layout.json` in `GameView` (does not override server board).

## Reconnect

- Refresh on lobby: re-emit `lobby:join` or `lobby:sync_request`.
- Refresh in game: `game:join` + `game:sync_request` if needed.

## Auth / profile flow

1. `AuthLoginPage` can start a Supabase anonymous session with the guest button.
2. `ProfileEditPage` auto-starts a guest session if the user opens it without an access token.
3. `ProfileViewPage` loads public profile data by id.
4. `AuthSignupPage` can merge the current anon profile into a new registered account.
