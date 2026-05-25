# Game model

Rules are implemented in **`@rune-race/game-engine`** (`packages/game-engine/src/engine.ts`). The server calls `handleRoll` / `handleChooseMove` from `commands.ts`.

Board geometry comes from `packages/game-engine/data/board-layout.json` (shared with the web client).

## Core entities

See `packages/shared/src/types/game.ts` for full types.

| Entity | Notes |
|--------|--------|
| **Player** | `id`, `name`, `color` |
| **Token** | `id` = `${playerId}:${index}`; `state`, `position` |
| **Turn** | `phase`, `diceResult`, `legalMoves`, `currentPlayerId` |
| **GameState** | `roomId` holds **gameId** value; `version`, `events`, `winnerId` when finished |

## Board (summary)

- Main track: 40 steps (from layout JSON).
- Home lane: 4 steps per player.
- 4 tokens per player.
- Safe tiles and per-color spawn / home-lane entry: see layout `meta` and engine helpers.
- Pawn colors on the 3D board use **color slot** (not raw player array index).

## Turn flow

1. **`waiting_roll`** — active player calls `game:roll`.
2. Server rolls dice, computes `legalMoves`.
3. **0 moves** — turn advances (may append finish events for players fully in home lane).
4. **1 move** — server auto-calls `resolveTurn` (client gets one snapshot).
5. **2+ moves** — **`waiting_choice`** until `game:choose_move`.
6. After resolve: extra turn if dice was **6** and player not finished; else next non-finished player.

Phases `resolving_move`, `play_cards`, `turn_end` exist in types; MVP flow uses the subset above.

## Move rules (MVP)

| Rule | Behavior |
|------|----------|
| Spawn | Dice **1** or **6**; entry square must be free |
| Move | Forward by dice value on track / home lane |
| Capture | Enemy on non-safe tile; captured token → base |
| Home lane | Enter after completing main loop; exact count to finish |
| Player “finished” | All 4 tokens in `in_home_lane` or `finished` → `token_finished` event with rank |
| Skip turn | Finished players are skipped in turn order |

## Game end

```ts
shouldEndGameByFinishCount(playerCount, finishedCount)
// true when finishedCount >= playerCount - 1
```

Examples:

- **3 players:** ends when **2** have finished (1 left — no need to play out).
- **4 players:** ends when **3** have finished.
- **2 players:** ends when **1** has finished.

`winnerId` is the first player in finish order (`finishOrder[0]`).

## Game events

Appended to `GameState.events` (server sends **delta** on updates):

| Type | Use |
|------|-----|
| `dice_roll` | `details.result` |
| `token_moved` | Path steps for animation |
| `token_captured` | Capture from/to |
| `token_finished` | `details.playerId`, `rank` |
| `turn_advanced` | `details.nextPlayerId`, `reason` |
| `error` | Rare; validation failures usually go to `game:error` socket event |

## Server internals

| Module | Responsibility |
|--------|----------------|
| `LobbyStore` | Players, ready, countdown, host actions, `onGameStart` |
| `GameStore` | Session map, `roll` / `chooseMove`, listeners |
| `game-engine` | Pure state transitions; no I/O |

Client must not compute authoritative legal moves for online play (local `/play/local` uses the same engine for testing).
