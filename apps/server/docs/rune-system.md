# Rune system (server)

Authoritative Rune layer implemented in `@rune-race/game-engine` and exposed via Socket.IO. Full gameplay rules: [docs/rune-specs.md](../../../docs/rune-specs.md) (Rule Lock v1.0).

## Enable / disable

- Lobby setting `LobbySettings.runesEnabled` (default `true`); host toggles via `lobby:update_settings`.
- On `onGameStart`, `GameStore.createGame` passes `runesEnabled` into `GameState.config.runesEnabled`.
- When disabled, engine skips rune state; only classic Cá Ngựa phases apply.

## Turn lifecycle (normal turn)

1. **Turn start housekeeping** — expire held cards, tick marker TTL, tick freeze, drain honesty rewards (`runTurnStartHousekeeping`).
2. **`waiting_draw`** — active player may `game:draw_cards` (max 25 draws / 10 hand per player).
3. **`placement_phase`** — opened automatically after draw or via `game:finish_draw`; min 5s / max 30s window; all players with hand cards may `game:place_marker`.
4. **`waiting_roll`** — entered when active player calls `game:roll` (closes placement, applies honesty rewards) or after placement timer expires.
5. **Roll + resolve** — `handleRoll` → stepwise movement with marker triggers (`token_stepped`) when runes enabled.
6. **`waiting_swap_choice`** — if SWAP marker triggers; resolved by `game:choose_swap`.

**Bonus turn** (dice 6): `turn.isBonusTurn === true`; skips steps 1–3 → `waiting_roll`.

## Socket handlers (`game-store.ts` → engine)

| Command | Engine entry |
|---------|----------------|
| `game:draw_cards` | `handleDrawCards` |
| `game:finish_draw` | `handleFinishDraw` |
| `game:place_marker` | `handlePlaceMarker` |
| `game:roll` | `rollTurnWithRunes` (closes draw/placement first) |
| `game:choose_move` | `chooseMoveWithRunes` |
| `game:choose_swap` | `handleChooseSwap` |

## Per-client snapshots

Server stores full `BoardMarker` (includes `cardType`, `realPlacerId`). Broadcast uses `buildClientGameSnapshot`:

- `state` — public markers only (`PublicBoardMarker`: id, cellId, displayedIdentityId)
- `runeView.myMarkers` — `{ markerId, cardType }[]` for markers the viewer placed

Implemented in `packages/shared/src/snapshot.ts`; called from `apps/server/src/socket/handlers.ts`.

## Card catalog

11 types in `RUNE_CARD_TYPES` / `RUNE_CARD_DEFINITIONS` (`packages/shared/src/types/rune-definitions.ts`):

| Type | Category | Trigger |
|------|----------|---------|
| LEAVE_STABLE, SEND_HOME, SWAP | SUPPORT / TRAP / SPECIAL | EXACT_STOP |
| SHIELD, ADVANCE_2/3/4, BACK_3/4/5, FREEZE | SUPPORT / TRAP | PASS_THROUGH |

Constants: `RUNE_MAX_HAND_SIZE = 10`, `RUNE_MAX_DRAW_PER_PLAYER = 25`, `RUNE_HELD_CARD_ROUNDS = 2`, `RUNE_FREEZE_TURNS = 3`, `RUNE_HONESTY_STREAK_FOR_REWARD = 5`.

## Game events (rune-related)

Appended to `GameState.events` (sent as delta on updates):

| Type | Use |
|------|-----|
| `cards_drawn` | Draw result |
| `held_card_expired` | Hand TTL expired |
| `placement_phase_opened` | Window timing |
| `marker_placed` / `marker_place_rejected` | Placement |
| `marker_expired` / `marker_triggered` | Board markers |
| `token_stepped` | Per-cell move + trigger resolution |
| `token_swapped` | SWAP resolution |
| `horse_status_changed` | Shield / freeze on token |
| `honesty_reward_granted` | Streak reward queued |

## Engine modules

```
packages/game-engine/src/
├── rune-commands.ts      # handleDrawCards, rollTurnWithRunes, …
├── rune/
│   ├── turn-lifecycle.ts # draw, placement open/close, bonus turn
│   ├── placement.ts      # markers, honesty streak
│   ├── movement.ts       # stepwise resolve, swap
│   ├── deck.ts           # random draw
│   ├── board-cells.ts    # valid placement cells
│   └── state.ts          # per-player rune state
```

## Error codes (game)

`DRAW_FAILED`, `FINISH_DRAW_FAILED`, `PLACE_FAILED`, `SWAP_FAILED`, plus `RUNES_DISABLED`, `INVALID_PHASE`, `NOT_YOUR_TURN` from engine validation.
