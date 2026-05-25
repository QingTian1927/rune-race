# Runtime flow

## Boot

1. `main.tsx` → `App` router.
2. `HomePage` calls `getOrCreatePlayerId()` (persisted in `localStorage`).
3. User creates/joins room → `/lobby/:lobbyId` or matchmaking → lobby.

## Lobby flow (`LobbyPage`)

1. `useLobbySocket` connects; emits `lobby:join` (password from router state if any).
2. UI renders `LobbySnapshot`: players, colors, ready, countdown.
3. Host: kick, settings, cancel countdown, transfer host.
4. All ready → server countdown 5s → `lobby:game_started`.
5. Navigate to `/game/:gameId`; store `rune-race-lobby-id` in `sessionStorage` for back link.

## Online game flow (`OnlineGamePage`)

1. `useGameSocket(gameId, playerId)` → `game:join` on connect.
2. `GameView` receives display state from presentation hook.
3. **Roll:** if `canRoll` (my turn, `waiting_roll`, not presenting dice) → `game:roll`.
4. Server snapshot with delta `dice_roll` (+ maybe `token_moved` if auto-resolved):
   - Increment `rollTrigger` → `DiceShaker` animates.
   - Tokens frozen until animation completes.
5. **Choice:** if `waiting_choice` and multiple moves and `localPlayerId === currentPlayerId` → arrows on my pawns only → `game:choose_move`.
6. **Finished:** `GameState.status === 'finished'`; show winner / finish order.

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

## Game rules (display / testing)

Aligned with `@rune-race/game-engine`:

- Spawn on **1** or **6**
- Extra turn on **6**
- Finish rank when all tokens in final zone
- Game ends when **all but one** player have finished
- Finished players skipped in turn order

## Camera / editor

- Default: `OrbitControls` on gameplay viewport.
- Editor active + mouse mode `draw`: controls locked for layout editing.
- Editor data loaded from `data/board-layout.json` in `GameView` (does not override server board).

## Reconnect

- Refresh on lobby: re-emit `lobby:join` or `lobby:sync_request`.
- Refresh in game: `game:join` + `game:sync_request` if needed.
