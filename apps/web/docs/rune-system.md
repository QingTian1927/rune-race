# Rune system (client)

Implementation reference for the Rune layer on the web client. Full gameplay rules: [docs/rune-specs.md](../../../docs/rune-specs.md) (Rule Lock v1.2).

## When runes are active

- Lobby setting `settings.runesEnabled` (host toggle, default `true`) is copied into `GameState.config.runesEnabled` at match start.
- When disabled, the client hides rune HUD/3D layers; turn flow skips draw/placement and behaves like classic Cá Ngựa.

## Turn phases (with runes)

Normal turn (not bonus from rolling 6):

```
waiting_draw → placement_phase → leave_stable_phase? → waiting_roll → … → waiting_choice? → resolve
```

| Phase | Client action |
|-------|----------------|
| `waiting_draw` | Active player may draw cards (`game:draw_cards`) or finish draw (`game:finish_draw`) |
| `placement_phase` | All players with cards in hand may place markers (`game:place_marker`); confirm when done (`game:confirm_placement_ready`); after confirm, that player cannot place, draw, or interact with the deck until the phase closes; **roll hidden** until phase ends |
| `leave_stable_phase` | Active player may tap `LEAVE_STABLE` (`game:use_leave_stable`) when spawn is legal, or roll to skip. Card is **greyed out** when no tokens remain in base or own horse blocks start cell (`canSpawnFromLeaveStable`) |
| `waiting_roll` | Active player rolls dice (`game:roll`) |
| `waiting_choice` | Pick pawn on board → `game:choose_move` |
| `waiting_swap_choice` | Pick swap target pawn → `game:choose_swap` |

Bonus turn (rolled 6): skips draw/placement/leave-stable → `waiting_roll` with `turn.isBonusTurn === true`.

## Placement phase UX

1. HUD shows `PhaseCountdownBar` (label + shrinking progress bar) for placement window (5–30s) and ready count (`readyByPlayer`).
2. Select a card in `HandArrayPanel`.
3. Tap a valid shared-track cell (`listValidPlacementCellIds` from game-engine).
4. Choose displayed identity (self or another player).
5. Confirm in overlay → `placeMarker`.
6. When finished placing (or with nothing left to place), press **Xác nhận đặt xong** → `confirmPlacementReady`.
7. **After confirm (per player):** selection clears immediately; hand cards and deck are no longer interactive for that player until the placement window closes (`iConfirmedPlacement` from `placement.readyByPlayer[localPlayerId]`). Other players who have not confirmed may still place.
8. When placement closes globally, hand card selection clears for everyone; roll button appears for active player.

**Roll during placement:** Not allowed. `canRoll` is `false` in `placement_phase`. Server returns `PLACEMENT_NOT_CLOSED` if roll is attempted early.

Any seated player with cards may place during simultaneous placement, not only the active player.

### Placement confirm lock (client)

`GameView` gates rune interaction with `iConfirmedPlacement`:

| Action | Before confirm | After confirm |
|--------|----------------|---------------|
| Select / preview hand cards | Yes (`canPlaceRunes`) | No — cards not selectable; notice *"Bạn đã xác nhận đặt xong"* |
| Pick placement cells / overlay | Yes | No — overlay closes |
| Draw from deck | Active player only (`canDrawDuringTurn`) | No — deck disabled; tooltip *"Đã xác nhận đặt xong"* |
| **Xác nhận đặt xong** button | Enabled | Disabled — label *"Đã xác nhận đặt xong"* |

`useEffect` calls `clearPlacementSelection()` when `iConfirmedPlacement` becomes true. Server still rejects late `game:place_marker` / `game:draw_cards` with `PLACEMENT_CONFIRMED` or `marker_place_rejected` (`reason: placement_confirmed`).

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

`state.rune.placement.readyByPlayer` drives the confirm counter in `GameView`.

## Socket commands

| Emit | When |
|------|------|
| `game:draw_cards` | `{ playerId, count }` — active player, `waiting_draw` or `placement_phase` (not after that player confirmed) |
| `game:confirm_draw` | `{ playerId }` — active player, accept pending draw preview (not after that player confirmed during placement) |
| `game:finish_draw` | `{ playerId }` — active player, `waiting_draw` → opens placement |
| `game:place_marker` | `{ playerId, heldCardId, cellId, displayedIdentityId }` — during `placement_phase` (not after that player confirmed) |
| `game:confirm_placement_ready` | `{ playerId }` — during `placement_phase`; idempotent per player |
| `game:use_leave_stable` | `{ playerId, heldCardId }` — during `leave_stable_phase` only |
| `game:roll` | Active player — `waiting_roll` or `leave_stable_phase` (not during placement) |

Handled in `hooks/useGameSocket.ts`; wired through `GameView` props.

## UI components

| Component | Role |
|-----------|------|
| `HandArrayPanel` | Bottom-left hand (max 5); draw button when active player's turn; disabled card tooltip via `getCardDisabledTitle` |
| `PhaseCountdownBar` | Small HUD countdown bar (placement, roll timeout, move-choice timeout) |
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
onConfirmPlacementReady?: () => void
onUseLeaveStable?: (heldCardId: string) => void
onChooseSwap?: (targetTokenId: string) => void
```

`canRoll` (from `OnlineGamePage`) is true when it is your turn and phase is `waiting_roll` or `leave_stable_phase` — **not** during `placement_phase` or `waiting_draw`.

## Turn timeouts (anti-AFK)

When it is the local player's turn, `GameView` starts client timers aligned with the server:

| Phase | Timeout | Auto action |
|-------|---------|-------------|
| `waiting_roll` / `leave_stable_phase` | **10s** | `onRoll()` |
| `waiting_choice` (2+ moves) | **20s** | `onSelectMove(legalMoves[0].id)` |

`PhaseCountdownBar` + `usePhaseCountdown` show remaining time. Timers clear on phase change or when the player acts. Online play still relies on server `tickTurnTimeouts` for disconnected clients.

## Swap UX

When a SWAP marker triggers, phase becomes `waiting_swap_choice`. Selectable tokens: other `on_track` tokens belonging to the **displayed identity** (not the activator). Mode `swap` on `BoardPieces` selection.

## Animation events

Watch delta `events` for rune-related types (same version cursor as `tokenMotion.ts`):

- `cards_drawn`, `held_card_expired`, `placement_phase_opened`, `placement_ready_confirmed`
- `marker_placed`, `marker_place_rejected`, `marker_expired`, `marker_triggered`
- `token_stepped` (per-cell movement with rune resolution; `details.motion` may be `step`, `rune_step`, or `teleport`)
- `token_moved` — `details.path[]` with `motion: 'step' | 'teleport'` for client animation
- `token_captured` — kick at final dice landing or teleport burst landing
- `token_swapped`, `horse_status_changed` (shield / freeze)

### Teleport animation (`BoardPieces.tsx`)

- Each path waypoint with `motion: 'teleport'` is one animation segment (shrink/disappear → appear at destination).
- Consecutive teleports in a chain (e.g. ADVANCE then BACK) play **one segment per link**; the client does not merge them into a single jump.
- Dice steps use arc `step` motion; teleport uses `runeTeleportMotion`.

## Local mode

`/play/local` uses the same engine via `mock/mockGameEngine.ts` with identical rune props on `GameView`.
