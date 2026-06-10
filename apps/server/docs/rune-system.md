# Rune system (server)

Authoritative Rune layer implemented in `@rune-race/game-engine` and exposed via Socket.IO. Full gameplay rules: [docs/rune-specs.md](../../../docs/rune-specs.md) (Rule Lock v1.2).

## Enable / disable

- Lobby setting `LobbySettings.runesEnabled` (default `true`); host toggles via `lobby:update_settings`.
- On `onGameStart`, `GameStore.createGame` passes `runesEnabled` into `GameState.config.runesEnabled`.
- When disabled, engine skips rune state; only classic Cá Ngựa phases apply.

## Turn lifecycle (normal turn)

1. **Turn start housekeeping** — expire held cards, tick marker TTL, tick freeze, drain honesty rewards (`runTurnStartHousekeeping`).
2. **`waiting_draw`** — active player may `game:draw_cards` or `game:finish_draw`.
3. **`placement_phase`** — opened after draw; min 5s / max 30s window; all players with hand cards may `game:place_marker` and `game:confirm_placement_ready`. After a player confirms, that player is locked out of further placement and draw until the window closes.
4. **Placement close** — server ticks every 1s (`GameStore.tickPlacementPhases`); closes when `now >= maxCloseAt` **or** (`now >= minCloseAt` and all players confirmed ready).
5. **`leave_stable_phase`** — opened after placement if active player holds `LEAVE_STABLE`; optional `game:use_leave_stable` when spawn is legal (tokens in base, start cell clear). Card is greyed out client-side when unusable.
6. **`waiting_roll`** — active player `game:roll`. Roll during placement returns `PLACEMENT_NOT_CLOSED`.
7. **Roll + resolve** — `handleRoll` → stepwise movement with marker triggers (`token_stepped`) when runes enabled.
8. **`waiting_swap_choice`** — if SWAP marker triggers; resolved by `game:choose_swap`.

**Bonus turn** (dice 6): `turn.isBonusTurn === true`; skips steps 1–5 → `waiting_roll`.

## Placement confirm

| Command | Handler | Notes |
|---------|---------|-------|
| `game:confirm_placement_ready` | `handleConfirmPlacementReady` | Sets `placement.readyByPlayer[playerId] = true`; emits `placement_ready_confirmed`; idempotent for the same player |

Early close when `canClosePlacementEarly(state, now)` — all seated players confirmed and `now >= minCloseAt`.

`prepareRollWithRunes` rejects roll while `turn.phase === 'placement_phase'` with `PLACEMENT_NOT_CLOSED`.

### Per-player lock after confirm

Once `placement.readyByPlayer[playerId] === true`, the engine rejects further rune actions for that player until placement closes:

| Command | Engine | Failure |
|---------|--------|---------|
| `game:place_marker` | `placeMarker` | `marker_place_rejected` event, `details.reason: placement_confirmed` |
| `game:draw_cards` | `handleDrawCards` | `DRAW_FAILED` / `PLACEMENT_CONFIRMED` |
| `game:confirm_draw` | `handleConfirmDraw` | `CONFIRM_DRAW_FAILED` / `PLACEMENT_CONFIRMED` |

Other players who have not confirmed may still place. The client mirrors this lock (`iConfirmedPlacement` in `GameView`).

## Socket handlers (`game-store.ts` → engine)

| Command | Engine entry |
|---------|----------------|
| `game:draw_cards` | `handleDrawCards` |
| `game:confirm_draw` | `handleConfirmDraw` |
| `game:finish_draw` | `handleFinishDraw` |
| `game:place_marker` | `handlePlaceMarker` |
| `game:confirm_placement_ready` | `handleConfirmPlacementReady` |
| `game:use_leave_stable` | `handleUseLeaveStable` — only `leave_stable_phase` |
| `game:roll` | `rollTurnWithRunes` (via `prepareRollWithRunes`) |
| `game:choose_move` | `chooseMoveWithRunes` |
| `game:choose_swap` | `handleChooseSwap` |

## Movement and capture

Implemented in `packages/game-engine/src/rune/movement.ts`:

| Move type | Path waypoints | Kick / capture |
|-----------|----------------|----------------|
| Dice steps | `motion: 'step'` per cell | Kick **enemies only** at **final landing** (`applyTraditionalCapture`); friendly landing = illegal move |
| ADVANCE/BACK burst | One `motion: 'teleport'` per burst end | Kick at **each burst landing** — friendly or enemy (`allowFriendlyCapture: true`) |
| Pass-through during burst | Not in path | No kick on intermediate cells |

**Teleport chain:** Each Tiến/Lùi link in a marker chain ends with its own teleport waypoint. If a new chain marker triggers mid-burst, the current burst closes at that cell (teleport + landing kick) before the next effect stacks.

`enforceNoTrackOverlap` is a safety net after moves.

## Per-client snapshots

Server stores full `BoardMarker` (includes `cardType`, `realPlacerId`). Broadcast uses `buildClientGameSnapshot`:

- `state` — public markers only (`PublicBoardMarker`: id, cellId, displayedIdentityId)
- `runeView.myMarkers` — `{ markerId, cardType }[]` for markers the viewer placed

Implemented in `packages/shared/src/snapshot.ts`; called from `apps/server/src/socket/handlers.ts`.

## Card catalog

11 types in `RUNE_CARD_TYPES` / `RUNE_CARD_DEFINITIONS` (`packages/shared/src/types/rune-definitions.ts`):

| Type | Category | Trigger |
|------|----------|---------|
| LEAVE_STABLE | SUPPORT | DIRECT_USE (not a board marker) |
| SEND_HOME, SWAP | TRAP / SPECIAL | EXACT_STOP |
| SHIELD, ADVANCE_2/3/4, BACK_3/4/5, FREEZE | SUPPORT / TRAP | PASS_THROUGH |

Constants: `RUNE_MAX_HAND_SIZE = 5`, `RUNE_MAX_DRAW_PER_PLAYER = 25`, `RUNE_HELD_CARD_ROUNDS = 2`, `RUNE_FREEZE_TURNS = 3`, `RUNE_HONESTY_STREAK_FOR_REWARD = 5`, `RUNE_TOKENS_PER_PLAYER = 2`, `CLASSIC_TOKENS_PER_PLAYER = 4`.

## Turn timeouts (anti-AFK)

`GameStore.tickTurnTimeouts` runs every **1s** alongside `tickPlacementPhases`:

| Phase | Timeout | Server action |
|-------|---------|---------------|
| `waiting_roll` or `leave_stable_phase` | **10s** | `roll(gameId, currentPlayerId)` |
| `waiting_choice` (2+ legal moves) | **20s** | `chooseMove` with first `legalMoves[0].id` |

Timer resets when phase or turn id changes. `game:turn_timeout_warning` is still not emitted; clients show their own countdown bar for UX.

## Game events (rune-related)

Appended to `GameState.events` (sent as delta on updates):

| Type | Use |
|------|-----|
| `cards_drawn` | Draw result |
| `held_card_expired` | Hand TTL expired |
| `placement_phase_opened` | Window timing (`minCloseAt`, `maxCloseAt`) |
| `placement_ready_confirmed` | Player confirmed placement done |
| `marker_placed` / `marker_place_rejected` | Placement |
| `marker_expired` / `marker_triggered` | Board markers |
| `token_stepped` | Per-cell move + trigger resolution (`motion`: step / rune_step / teleport) |
| `token_moved` | Final path with `motion` per waypoint for client animation |
| `token_captured` | Kick at landing (dice final or teleport burst) |
| `token_swapped` | SWAP resolution |
| `horse_status_changed` | Shield / freeze on token |
| `honesty_reward_granted` | Streak reward queued |
| `leave_stable_used` | Direct-use Xuất Chuồng |

## Engine modules

```
packages/game-engine/src/
├── rune-commands.ts      # handleDrawCards, rollTurnWithRunes, handleConfirmPlacementReady, …
├── rune/
│   ├── turn-lifecycle.ts # draw, placement open/close, bonus turn
│   ├── placement.ts      # markers, honesty streak, confirm ready, tick
│   ├── leave-stable.ts   # leave_stable_phase, direct use
│   ├── movement.ts       # stepwise resolve, teleport chain, capture
│   ├── deck.ts           # random draw
│   ├── board-cells.ts    # valid placement cells
│   └── state.ts          # per-player rune state
```

## Error codes (game)

`DRAW_FAILED`, `FINISH_DRAW_FAILED`, `PLACE_FAILED`, `SWAP_FAILED`, `PLACEMENT_NOT_CLOSED`, `PLACEMENT_CONFIRMED` (player already confirmed during placement window), plus `RUNES_DISABLED`, `INVALID_PHASE`, `NOT_YOUR_TURN` from engine validation.

`marker_place_rejected` may include `details.reason: placement_confirmed` when placement was already confirmed for that player.
