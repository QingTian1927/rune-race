# Game model

Rules are implemented in **`@rune-race/game-engine`** (`packages/game-engine/src/engine.ts`, `rune-commands.ts`). The server calls engine handlers from `GameStore`.

Board geometry comes from `packages/game-engine/data/board-layout.json` (shared with the web client).

Design spec: [docs/rune-specs.md](../../../docs/rune-specs.md). Implementation details for runes: [Rune system](./rune-system.md).

## Core entities

See `packages/shared/src/types/game.ts` and `types/rune.ts`.

| Entity | Notes |
|--------|--------|
| **Player** | `id`, `name`, `color` |
| **Token** | `id` = `${playerId}:${index}`; `state`, `position`; optional `hasShield`, `freezeTurnsRemaining` |
| **Turn** | `phase`, `diceResult`, `legalMoves`, `currentPlayerId`, `isBonusTurn`, `pendingSwap` |
| **GameState** | `roomId` holds **gameId**; `config.runesEnabled`; `rune: RuneGameState \| null`; `version`, `events`, `winnerId` |
| **RuneGameState** | `markers`, `players` (hand/draw counts), `placement` window |

## Board (summary)

- Main track: **44** steps (from layout JSON `meta.mainTrackSteps`).
- Home lane: **5** steps per player (`homeLaneStepsPerPlayer`).
- **4** tokens per player in classic mode (`CLASSIC_TOKENS_PER_PLAYER`); **2** in rune mode (`RUNE_TOKENS_PER_PLAYER`). Use `tokensPerPlayer(config.runesEnabled)` from `@rune-race/shared`.
- Shared-track cells only for rune marker placement (`board-cells.ts`).
- Safe tiles and per-color spawn / home-lane entry: see layout `meta` and engine helpers.
- Pawn colors on the 3D board use **color slot** (not raw player array index).

## Turn flow

### Without runes (`config.runesEnabled === false`)

1. **`waiting_roll`** — active player calls `game:roll`.
2. Server rolls dice, computes `legalMoves`.
3. **0 moves** — turn advances.
4. **1 move** — server auto-resolves (single snapshot).
5. **2+ moves** — **`waiting_choice`** until `game:choose_move`.
6. Extra turn if dice was **6** and player not finished; else next non-finished player.

### With runes (normal turn)

1. Turn start housekeeping (expire hand cards, marker TTL, freeze ticks, honesty rewards).
2. **`waiting_draw`** — active player may `game:draw_cards`.
3. **`placement_phase`** — simultaneous marker placement (5–30s min / 30s max, server tick 1s); any player with hand cards may place until they confirm; each player may `game:confirm_placement_ready` once (`placement.readyByPlayer`); after confirm, that player cannot place or draw until the window closes; closes early when all confirmed after min window.
4. **`leave_stable_phase`** — optional direct-use `LEAVE_STABLE` for active player (skipped if not in hand).
5. **`waiting_roll`** — active player `game:roll`. Roll is **blocked** during `placement_phase` (`PLACEMENT_NOT_CLOSED`).
6. Roll + **stepwise** resolve with marker triggers (`token_stepped`).
7. **`waiting_swap_choice`** if SWAP marker requires target selection.
8. Extra turn on **6** skips steps 1–4 (`isBonusTurn`).

Phases `resolving_move`, `play_cards`, `turn_end` exist in types; runtime uses the subset above.

## Move rules (MVP)

| Rule | Behavior |
|------|----------|
| Spawn | Dice **1** or **6**; entry square must be free |
| Move | Forward by dice value on track / home lane |
| Capture (dice) | Enemy only at **final landing** of turn; pass-through does not capture; friendly landing = illegal move |
| Capture (teleport) | Friendly or enemy at **each teleport burst landing**; pass-through cells unaffected |
| Home lane | Enter after completing main loop; exact count to finish |
| Freeze | Token cannot be selected for `RUNE_FREEZE_TURNS` normal turns |
| Shield | Blocks one capture while active |
| Player “finished” | All of that player’s tokens in `in_home_lane` or `finished` → `token_finished` event with rank |
| Skip turn | Finished players are skipped in turn order |

## Game end

```ts
shouldEndGameByFinishCount(playerCount, finishedCount)
// true when finishedCount >= playerCount - 1
```

Examples:

- **3 players:** ends when **2** have finished.
- **4 players:** ends when **3** have finished.
- **2 players:** ends when **1** has finished.

`winnerId` is the first player in finish order (`finishOrder[0]`).

## Game events

Appended to `GameState.events` (server sends **delta** on updates):

| Type | Use |
|------|-----|
| `dice_roll` | `details.result` |
| `token_moved` | Final path / destination for animation |
| `token_stepped` | Per-cell step during rune-aware movement |
| `token_captured` | Capture from/to |
| `token_finished` | `details.playerId`, `rank` |
| `token_swapped` | SWAP marker resolution |
| `turn_advanced` | `details.nextPlayerId`, `reason` |
| `cards_drawn` | Rune draw |
| `held_card_expired` | Hand TTL |
| `placement_phase_opened` | Placement window (`minCloseAt`, `maxCloseAt`) |
| `placement_ready_confirmed` | Player confirmed placement done |
| `marker_placed` / `marker_place_rejected` | Placement |
| `marker_expired` / `marker_triggered` | Marker lifecycle |
| `horse_status_changed` | Shield / freeze |
| `honesty_reward_available` / `honesty_reward_selected` / `honesty_reward_granted` | Honesty streak reward (available → choose 1 of 5 support cards → appended to hand, even past 5 cards) |
| `error` | Rare; validation failures usually go to `game:error` socket event |

## Server internals

| Module | Responsibility |
|--------|----------------|
| `LobbyStore` | Players, ready, countdown, host actions, `runesEnabled`, `onGameStart` |
| `GameStore` | Session map, classic + rune commands, `tickPlacementPhases` + `tickTurnTimeouts`, `buildClientGameSnapshot` listeners |
| `ChatStore` | Lobby-scoped messages |
| `game-engine` | Pure state transitions; no I/O |

Client must not compute authoritative legal moves for online play (local engine testing uses the same package in dev).
