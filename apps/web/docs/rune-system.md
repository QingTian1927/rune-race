# Rune system (client)

Implementation reference for the Rune layer on the web client. Full gameplay rules: [docs/rune-specs.md](../../../docs/rune-specs.md) (Rule Lock v1.0).

## When runes are active

- Lobby setting `settings.runesEnabled` (host toggle, default `true`) is copied into `GameState.config.runesEnabled` at match start.
- When disabled, the client hides rune HUD/3D layers; turn flow skips draw/placement and behaves like classic Cá Ngựa.

## Turn phases (with runes)

Normal turn (not bonus from rolling 6):

```
waiting_draw → placement_phase → waiting_roll → … → waiting_choice? → resolve
```

| Phase | Client action |
|-------|----------------|
| `waiting_draw` | Active player may draw cards (`game:draw_cards`) or press roll to skip remaining draw |
| `placement_phase` | All players with cards in hand may place markers (`game:place_marker`); active player may roll after min window (5s) to close placement |
| `waiting_roll` | Active player rolls dice (`game:roll`) |
| `waiting_choice` | Pick pawn on board → `game:choose_move` |
| `waiting_swap_choice` | Pick swap target pawn → `game:choose_swap` |

Bonus turn (rolled 6): skips draw/placement → `waiting_roll` with `turn.isBonusTurn === true`.

## Snapshot shape

`game:state_snapshot` payload is `ClientGameSnapshot`:

```ts
{
  version: number
  state: GameState          // rune.markers are public (no cardType / realPlacerId)
  events: GameEvent[]       // delta during play
  runeView: RuneClientView | null  // private overlay for this client
}
```

`runeView.myMarkers` lists `{ markerId, cardType }` only for markers **you** placed. Use this for tooltips; opponents see pin + displayed identity only.

## Socket commands

| Emit | When |
|------|------|
| `game:draw_cards` | `{ playerId, count }` — your turn, `waiting_draw` or `placement_phase` |
| `game:finish_draw` | `{ playerId }` — optional explicit transition `waiting_draw` → `placement_phase` (roll also closes draw) |
| `game:place_marker` | `{ playerId, heldCardId, cellId, displayedIdentityId }` — during `placement_phase` |
| `game:choose_swap` | `{ playerId, targetTokenId }` — during `waiting_swap_choice` |

Handled in `hooks/useGameSocket.ts`; wired through `GameView` props.

## UI components

| Component | Role |
|-----------|------|
| `HandArrayPanel` | Bottom-left hand (max 10); draw button when active player's turn |
| `RuneCardPreviewOverlay` | Card preview + placement confirm |
| `RuneMarkers` / `RuneMapPin3D` | 3D pins on shared track cells |
| `RunePlacementLayer` | Cell picking during placement phase |
| `RuneIdentityPanel` | Pick displayed identity (impersonation) before confirm |

Assets and labels: `lib/runeAssets.ts`. Cell ids: `lib/trackCellId.ts`, picking: `lib/placementCellPick.ts`.

## GameView rune props

```ts
runeView?: RuneClientView | null
onDrawCards?: (count: number) => void
onFinishDraw?: () => void
onPlaceMarker?: (heldCardId, cellId, displayedIdentityId) => void
onChooseSwap?: (targetTokenId: string) => void
```

`canRoll` (from `OnlineGamePage`) is true when it is your turn and phase is `waiting_roll`, `waiting_draw`, or `placement_phase` — pressing roll during draw/placement closes the rune window server-side then rolls.

## Placement UX

1. Select a card in `HandArrayPanel`.
2. Tap a valid shared-track cell (`listValidPlacementCellIds` from game-engine).
3. Choose displayed identity (self or another player).
4. Confirm in overlay → `placeMarker`.

Any seated player with cards may place during simultaneous placement, not only the active player.

## Swap UX

When a SWAP marker triggers, phase becomes `waiting_swap_choice`. Selectable tokens: other `on_track` tokens belonging to the **displayed identity** (not the activator). Mode `swap` on `BoardPieces` selection.

## Animation events

Watch delta `events` for rune-related types (same version cursor as `tokenMotion.ts`):

- `cards_drawn`, `held_card_expired`, `placement_phase_opened`
- `marker_placed`, `marker_place_rejected`, `marker_expired`, `marker_triggered`
- `token_stepped` (per-cell movement with rune resolution)
- `token_swapped`, `horse_status_changed` (shield / freeze)

## Local mode

`/play/local` uses the same engine via `mock/mockGameEngine.ts` with identical rune props on `GameView`.
