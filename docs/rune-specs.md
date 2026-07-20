**RUNE RACE**

**GAMEPLAY RULES, SPOOFED IDENTITY, AND RUNE CARD SYSTEM SPECIFICATION**

*Gameplay Rule & Rune System Specification*

| **Version** | 1.2 — Rule lock: hand array and honesty reward updates |
|-------------|--------------------------------------------------------|
| **Status** | Updated to match confirmed gameplay decisions |
| **Scope** | MVP web multiplayer, 2–4 players |
| **Purpose** | Game design, UI/UX, and server gameplay implementation |
| **Background** | Original Rune Race briefing and follow-up rule confirmations |

*Detailed product design specification*

# TABLE OF CONTENTS

**1.** Goals and document scope

**2.** Design principles and terminology

**3.** Turn gameplay loop

**4.** Draws, hand array, and rewards

**5.** Official Rune catalog

**6.** Simultaneous marker placement

**7.** Spoofed identity

**8.** Movement resolution and trigger chains

**9.** Per-card detailed rules

**10.** Marker lifecycle and horse status

**11.** Desktop and mobile UI design

**12.** Proposed server data model and events

**13.** Acceptance test scenarios

**14.** Inherited scope, limits, and notes

**Appendix A.** Rule-lock summary

**Appendix B.** Rune card artwork concept

| **Precedence:** This document overrides older Rune descriptions on conflict. Traditional Ludo/Parcheesi rules already in the MVP are inherited unless this document clearly changes or extends them. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

## Key changes in version 1.2

- Each player has 2 horses; win by bringing both home.

- Leave Stable is no longer a board marker. The card is used directly from the hand array after the placement phase and before the normal-turn dice roll.

- Leave Stable is always consumed on press, even when no horse can leave.

- A horse that just entered the start cell triggers markers on that cell as if it moved onto it normally.

- The normal hand array only allows additional draws while holding fewer than 5 unexpired cards.

- After 5 consecutive honest placements, the player picks 1 support card during the next normal turn’s draw/placement phase. The reward is appended to the hand array even when it already has 5 or more cards.

# 1. Goals and document scope

This document specifies the new Rune Race rules for the MVP. The focus is the layer on top of traditional Ludo/Parcheesi: each player controls 2 horses, draws random cards, uses Leave Stable directly from the hand array, secretly places markers on the shared track, resolves cards step-by-step, places simultaneously, and spoofs placer identity.

- Define the turn loop and when the placement phase opens.

- Lock the official list of 11 Rune types; remove Double Move from the new deck.

- Lock piece count: 2 horses per player; win by bringing both home.

- Lock Leave Stable as a direct-use hand card (no board marker).

- Describe the lifecycle of cards in the array vs markers on the board.

- Describe spoofed identity, honesty streak, and support rewards.

- Specify secret marker UI and owner-only tooltips.

- Provide data and acceptance tests for consistent implementation.

# 2. Design principles and terminology

## 2.1. Design principles

| **Principle** | **Implementation meaning** |
|---------------|----------------------------|
| Inherit traditional rules | Rune Race does not replace core Ludo/Parcheesi already in the MVP; Runes add tactics and psychology. |
| Two horses per player | Each player has 2 horses. Win by bringing both home. |
| Deliberate public information | Players see marker position and displayed identity, but not card type or true placer. |
| Step-by-step movement | Every cell passed may change direction or remaining steps. The server must resolve per step, not teleport start→end. |
| Two-way effects | Any horse entering a marker may be helped or hurt, including the true placer’s own horses. |
| Controlled chaos | Everyone may place in the same phase; cell conflicts resolve by first request received. |

## 2.2. Terminology

| **Term** | **Definition** |
|----------|----------------|
| Normal turn | A turn that starts at the active player’s draw step. Used as the unit for many timers. |
| Bonus turn from rolling 6 | Extra turn that resumes only from the dice roll. No redraw, no simultaneous placement, no Leave Stable window; does not count as a new expiry round. |
| Hand array | Unexpired held cards, shown bottom-left. Normal draws only when under 5 cards; honesty rewards may append above that threshold. |
| Marker | Secret board token created when a placeable card is laid on the shared track. Does not reveal Rune type. Leave Stable does not create markers. |
| Direct-use card | Activated from the hand without placing on the board. Leave Stable is the only direct-use card in this version. |
| Placeable card | Runes that can be laid on the shared track: Shield, Advance, Back, Freeze, Send Home, Swap. |
| True placer | The player who performed the place action. Never revealed to others. |
| Displayed identity | Avatar/color shown on the marker. May be the true placer or a spoofed player. |
| Pass-through marker | Triggers when a horse passes through the cell, even if it does not stop there. |
| Exact-stop marker | Triggers only if movement ends exactly on the marker cell. |
| Shared track | Cells usable by multiple players. Only these cells may receive markers. |

# 3. Turn gameplay loop

## 3.1. Normal turn

| **Step** | **Name** | **Description** |
|----------|----------|-----------------|
| 1 | Open normal turn | Expire the active player’s held cards before they draw, place, or use cards. |
| 2 | Draw | Active player may draw 0 or more random cards if personal draw quota is under 25 and hand has under 5 cards. If an honesty reward is due this turn, the system opens a pick of 1 support card in this same phase and appends it even when the hand already has 5+ cards. |
| 3 | Simultaneous placement | Every player holding unexpired placeable cards may place any number on legal cells. Keeping cards is allowed. |
| 4 | Leave Stable window | After placement, the active player may press one or more held Leave Stable cards. Each press consumes immediately. |
| 5 | Roll dice | Only the active player rolls. |
| 6 | Choose horse | Active player picks a legal horse under traditional rules and current status. |
| 7 | Step movement | Horse advances by the dice value. Server resolves each cell and markers per Section 8. |
| 8 | End turn | Update counters, marker lifecycles, and related effects. |

## 3.2. Bonus turn from rolling 6

If the player rolls a 6 and receives an extra turn under traditional rules, the flow resumes only from the dice roll. No Rune draws, no simultaneous placement, no Leave Stable window.

| **Repeat?** | **Draw** | **Placement** | **Leave Stable** | **Dice** | **Choose horse** | **Move** |
|-------------|----------|---------------|------------------|----------|------------------|----------|
| Bonus turn from 6 | No | No | No | Yes | Yes | Yes |

# 4. Draws, hand array, and rewards

## 4.1. Personal draw limit

- Each player may draw at most 25 random cards per match.

- This is a personal limit, not a shared match pool.

- During the normal-turn draw step, players may draw multiple times while quota and hand capacity allow.

- No draws during a bonus turn from rolling 6.

- Honesty reward cards do not count toward the 25-draw quota.

## 4.2. Hand array and normal draw threshold

- The hand array shows unexpired held cards at the bottom-left.

- Normal draws are only allowed while holding fewer than 5 unexpired cards.

- At 5+ cards, the normal draw button is disabled.

- Honesty rewards are an exception: after choosing a support card, the system appends it even at 5+ cards.

- Because rewards can stack, the hand may temporarily hold 6, 7, 8, or more cards. Normal draws stay locked until unexpired cards drop below 5.

- Players may keep cards for later turns while they remain unexpired.

- Each held card must show remaining rounds.

## 4.3. Unplaced card expiry

A card drawn into the hand expires after 2 rounds counted by the owner’s next normal turns. Bonus turns from rolling 6 do not reduce expiry. The same rule applies to unused Leave Stable cards.

| **Checkpoint** | **State of card A just drawn** |
|----------------|--------------------------------|
| During the draw turn | Unexpired; may place in the simultaneous phase or use if Leave Stable. |
| Owner’s next normal turn | Completed first round. |
| Owner’s following normal turn | Completed second round. |
| Start of the third following normal turn | Remove from the array before draw/placement opens. |

## 4.4. Honesty streak and reward cards

- A placement turn is honest if the player placed at least one marker and every marker they placed that phase used their own displayed identity.

- A turn with no markers placed leaves the honesty streak unchanged.

- Any spoofed marker in the phase resets the true placer’s streak to 0.

- After 5 consecutive honest placement turns, the reward is not granted on the fifth turn. The system marks 1 reward due on that player’s next normal turn.

- In the next normal turn’s draw/placement phase, the player picks 1 of 5 support cards: Leave Stable, Shield, Advance 2, Advance 3, or Advance 4.

- Reward selection is a special draw: the player chooses the type instead of receiving a random card.

- The reward is appended immediately, even at 5+ cards. No pending queue when the hand is full.

- If the player does not choose in time, the server picks one of the 5 support cards at random and appends it.

- Reward cards expire after 2 of the recipient’s rounds from the moment they are appended. Bonus turns from 6 do not reduce expiry.

- Rewards do not count toward the 25 personal draw quota.

- The player may use the reward immediately in the same turn as a freshly drawn card (Leave Stable in the Leave Stable window; placeable cards in the current placement phase).

- After the reward is received on the next normal turn, the honesty streak resets to 0. If the player places fully honest markers in that same placement phase, that turn becomes the first turn of a new streak.

- The system announces that player A received a support card for honesty. It does not reveal which card, how many cards A holds, or the reward’s remaining expiry.

# 5. Official Rune catalog

The new Rune set has 11 card types. Double Move from the older briefing is no longer official.

| **Group** | **Card** | **Trigger** | **Marker TTL** | **Role** |
|-----------|----------|-------------|----------------|----------|
| Support | Leave Stable | Direct use from hand | N/A | Before the normal-turn dice roll, the owner presses the card to try moving one horse from the stable to the start cell. Always consumed on press. |
| Support | Shield | Pass-through | 3 rounds | Grants at most one protection layer that blocks the next Back, Freeze, or Send Home trap. |
| Support | Advance 2 | Pass-through | 3 rounds | Adds 2 forward steps to the current movement. |
| Support | Advance 3 | Pass-through | 3 rounds | Adds 3 forward steps to the current movement. |
| Support | Advance 4 | Pass-through | 3 rounds | Adds 4 forward steps to the current movement. |
| Trap | Back 3 | Pass-through | 3 rounds | Forces the activating horse backward 3 steps; marker removed on trigger. |
| Trap | Back 4 | Pass-through | 3 rounds | Forces the activating horse backward 4 steps; marker removed on trigger. |
| Trap | Back 5 | Pass-through | 3 rounds | Forces the activating horse backward 5 steps; marker removed on trigger. |
| Trap | Freeze | Pass-through | 3 rounds | Stops the horse on the marker and locks it for the owner’s next 2 normal turns. |
| Trap | Send Home | Exact stop | 5 rounds | Sends the activating horse home immediately unless Shield cancels it. |
| Special | Swap | Exact stop | 5 rounds | Activator chooses a legal horse belonging to the displayed identity and swaps positions. |

# 6. Simultaneous marker placement

## 6.1. Placement phase

- Opens after the normal-turn draw and before the active player rolls.

- Every player with unexpired placeable cards may participate, not only the active player.

- Each player may place any number of placeable cards in the same phase. Leave Stable is never laid on the board.

- Players may place nothing or keep some cards for later phases.

## 6.2. Legal marker cells

| **Cell type** | **May place?** | **Notes** |
|---------------|----------------|-----------|
| Shared-track cell | Yes | Includes shared start cells and shared cells just outside stables. |
| Cell currently occupied by a horse | No | Cannot place on an occupied cell. |
| Private home stretch | No | Finish-path cells unique to one player are out of scope. |
| Cell that already has a marker | No | At most one secret marker per cell. |

| **No safe-star concept in the Rune spec:** Marker placement depends only on shared-track eligibility. If the traditional MVP has other special cells, handle them under base rules; this document does not grant Rune immunity there. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

## 6.3. Cell conflicts

If multiple players request the same empty cell in one phase, the server accepts the earliest request. Later requests fail; those cards stay in the failed placer’s hand and are not consumed.

# 7. Spoofed identity

## 7.1. Scope

Every marker uses spoofed identity, including Shield, Advance 2/3/4, Back 3/4/5, Freeze, Send Home, and Swap. Leave Stable creates no marker and does not use spoofing.

- When placing, the true placer chooses a displayed identity among players still in the match.

- Choosing yourself is allowed. That counts as an honest placement turn if every marker you place that phase displays yourself.

- Players who left or finished all horses cannot be chosen as displayed identity for new markers.

- The true placer is never revealed — not on trigger, expiry, or match end.

## 7.2. Public board information

- Markers appear as circular location icons on shared-track cells.

- Inside the circle: the displayed identity’s avatar.

- Marker color follows the displayed identity’s color.

- Card type is not shown on the public marker.

- Remaining TTL is not shown to other players.

# 8. Movement resolution and trigger chains

## 8.1. Step-by-step resolve

The server must not compute the final cell by only adding the dice value. Each hop resolves in sequence because markers may add steps, reverse direction, stop movement, or apply status.

```
resolveMovement(horse, initialDiceSteps):
  direction = FORWARD
  remainingSteps = initialDiceSteps

  while remainingSteps > 0:
    horse.moveOneCell(direction)
    remainingSteps -= 1

    resolvePassThroughMarkerIfPresent(horse, direction, remainingSteps)
    # May change direction, add steps, or stop all movement.

    resolveExactStopMarkerIfPresent(horse)
    resolveTraditionalRuleIfApplicable(horse)
```

## 8.2. Pass-through marker movement rules

| **Situation** | **Direction after** | **Result** |
|---------------|---------------------|------------|
| Moving forward, hit Advance N | Stay forward | Add N to remaining forward steps. |
| Moving forward, hit Back N | Switch to back | Discard remaining forward steps; start backing exactly N. |
| Moving back, hit Back N | Keep backing | Add N to remaining back steps. |
| Moving back, hit Advance N | Switch to forward | Discard remaining back steps; start advancing exactly N. |
| Hit Shield | No direction change | Marker removed. If horse had no Shield, grant one layer; if already shielded, marker still removed with no extra layer. |
| Hit Freeze without Shield | Stop immediately | Marker removed; clear remaining steps; apply Freeze. |
| Hit trap blocked by Shield | Continue movement | Trap marker removed; remove one Shield layer; no penalty applied. |

## 8.3. Marker chains

- Markers can chain. Example: Advance 3 then Advance 2 adds 5 bonus forward steps total.

- During forced Back movement, the horse still triggers markers it passes.

- While backing, hitting Advance immediately switches to forward with the new step count.

- While backing, hitting another Back stacks additional back steps.

- Exact-stop markers are checked after the current movement ends, whether the stop came from dice, Advance, or Back.

# 9. Per-card detailed rules

## 9.1. Advance 2 / 3 / 4

Support markers that trigger when a horse passes through.

- Marker removed on trigger.

- Steps stack into current forward movement.

- If the horse is being forced back, remaining back steps are discarded and the horse advances by the card’s step value.

- During bonus steps, further markers still resolve normally.

## 9.2. Back 3 / 4 / 5

Trap markers that trigger on pass-through.

- Marker removed on trigger.

- If moving forward, discard remaining forward steps and start backing by the card value.

- If already backing, add the new back steps to the remaining back count.

- While backing, pass-through markers still resolve.

- With Shield, the trap is consumed with no effect; Shield is also consumed.

## 9.3. Shield

Support marker that triggers on pass-through.

- Marker removed on trigger.

- A horse holds at most one Shield layer.

- Hitting another Shield while already shielded still removes the new marker but does not stack layers.

- Shield lasts until it cancels a trap or the horse is kicked home.

- Shield blocks Back, Freeze, and Send Home.

- Shield does not block Swap.

## 9.4. Freeze

Trap that triggers immediately on pass-through.

- Without Shield, the horse stops on the marker cell and discards remaining steps.

- Marker removed after trigger.

- The horse cannot be chosen to move for the owner’s next 2 normal turns.

- Bonus turns from rolling 6 do not reduce the Freeze counter and do not allow choosing a locked horse.

- A frozen horse can still be kicked home by traditional landing rules.

- If kicked home while Frozen, Freeze clears immediately.

## 9.5. Send Home

Trap that triggers only on exact stop.

- Marker removed on trigger.

- Without Shield, send the horse home immediately.

- With Shield, marker still removed but the effect is cancelled; Shield is consumed.

## 9.6. Leave Stable

Direct-use support card from the hand. Never placed on the board, creates no marker, has no marker TTL, and does not use spoofing.

- Only the active player may press Leave Stable after simultaneous placement and before the normal-turn dice roll.

- Bonus turns from rolling 6 do not reopen the Leave Stable window.

- Multiple Leave Stable cards may be pressed in one window; each press resolves independently.

- Every press always consumes the card and removes it from the hand, even when no horse can leave.

- Empty stable: no horse exits; card still consumed.

- Start cell occupied by the user’s own horse: no horse exits; card still consumed.

- Stable has a horse and start cell is not occupied by the user’s own horse: move one horse to start under existing traditional leave-stable rules.

- Start cell occupied by an opponent: apply traditional kick-home rules.

- If the start cell has a marker, the exiting horse is treated as entering that cell like a normal move. Resolve the start-cell marker by its trigger mode and continue chains per Section 8.

## 9.7. Swap

Special exact-stop marker.

- Marker always removed after trigger, even when no swap occurs.

- The controller of the activating horse chooses a legal horse belonging to the displayed identity and swaps positions.

- The chosen horse must be on the shared track.

- Horses in the stable, finished, or on a private home stretch are illegal.

- If displayed identity is the activator’s own identity, no swap; marker still removed.

- If displayed identity has no legal shared-track horse, no swap; marker still removed.

- Shield does not cancel Swap.

# 10. Marker lifecycle and horse status

## 10.1. Placed marker TTL

| **Marker group** | **Cards** | **TTL** |
|------------------|-----------|---------|
| Pass-through — 3 rounds | Advance 2/3/4, Shield, Back 3/4/5, Freeze | 3 rounds |
| Exact stop — 5 rounds | Send Home, Swap | 5 rounds |

## 10.2. Counting marker rounds

Marker TTL counts by the displayed identity’s next normal turns, even when that identity is not the true placer. Bonus turns from rolling 6 do not add rounds.

| **Marker TTL** | **Removed if never triggered** |
|----------------|--------------------------------|
| 3 rounds | At the start of the displayed identity’s fourth following normal turn. |
| 5 rounds | At the start of the displayed identity’s sixth following normal turn. |

## 10.3. When displayed identity leaves or finishes

If the displayed identity leaves or finishes all horses after the marker was placed, the marker remains. TTL counting switches to full-table rounds. Remaining TTL at switch time is preserved.

| **Minimum implementation note:** When switching from displayed-identity turns to full-table rounds, keep `remainingTTL`. Each completed full-table round decrements it by one. This matches “switch to table-round counting” without suddenly deleting markers. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

## 10.4. Freeze status

If A’s horse is Frozen on B’s turn, A cannot choose that horse for A’s next two normal turns. After A completes the second normal turn, Freeze clears. If the horse is kicked home earlier, Freeze clears immediately.

# 11. Desktop and mobile UI design

## 11.1. Board layout

- Keep the board central; markers anchor to shared-track cells.

- Use circular location icons so players see a Rune is present without knowing which one.

- Inside the circle: displayed identity avatar; ring/background uses that identity’s color.

- Do not show card-type art on the public marker.

- Do not show marker TTL to other players.

## 11.2. True placer marker tooltip

| **Platform** | **Interaction** | **Shown** |
|--------------|-----------------|-----------|
| Desktop | Hover marker | Only the Rune type that player placed. |
| Mobile / touch | Tap marker for a small tooltip | Only the Rune type that player placed. |
| Non-true placer | Hover or tap | No Rune type or TTL. |

## 11.3. Hand array (bottom-left)

- Show all unexpired held cards.

- Each card shows remaining rounds before expiry.

- Show current count (e.g. 4, 5, or 7 cards).

- At 5+ cards, disable normal draw and show a short reason.

- Honesty rewards still append at or above 5.

- When a reward is due, show a pick of 1 of 5 support cards in the draw/placement phase. On timeout, show the server-chosen type.

## 11.4. Simultaneous placement phase

- Show clear phase state so everyone knows marker placement is open.

- Selecting a placeable card highlights legal shared-track cells and locks illegal ones. Leave Stable does not open cell picking.

- After choosing a cell, open displayed-identity selection before sending the place request.

- If the server rejects because another player took the cell first, keep the card in hand and show placement failed.

## 11.5. Leave Stable interaction

- On the active player’s normal turn, after placement ends and before the dice roll, Leave Stable cards in the hand may be pressed directly.

- On press, the client sends use immediately; no cell or identity picker.

- After the server response, the card leaves the hand whether or not a horse exited.

- On success, animate from stable to start. If start has a marker, continue animating the Rune chain as a normal entry.

- If no horse can exit (empty stable or own horse on start), show brief feedback but still show the card consumed.

## 11.6. Trigger animation

- Horses move cell-by-cell so players can follow Rune resolution order.

- On trigger, remove the marker and play a short effect: advance arrow, back arrow, shield layer, freeze, send home, or swap.

- Animation may reveal the effect that happened but must never reveal the true placer.

# 12. Proposed server data model and events

Reference technical shape for consistent implementation. Field names may change in code; gameplay meaning must not.

## 12.1. CardDefinition

| **Field** | **Type** | **Meaning** |
|-----------|----------|-------------|
| cardType | enum | LEAVE_STABLE, SHIELD, ADVANCE_2, ADVANCE_3, ADVANCE_4, BACK_3, BACK_4, BACK_5, FREEZE, SEND_HOME, SWAP. |
| category | enum | SUPPORT, TRAP, or SPECIAL. |
| activationKind | enum | DIRECT_USE or BOARD_MARKER. LEAVE_STABLE uses DIRECT_USE; others use BOARD_MARKER. |
| triggerMode | enum \| null | PASS_THROUGH or EXACT_STOP for markers; null for LEAVE_STABLE. |
| markerTTL | number \| null | 3 or 5 for markers; null for LEAVE_STABLE. |
| stepValue | number \| null | Step value for Advance and Back cards. |

## 12.2. HeldCard

| **Field** | **Type** | **Meaning** |
|-----------|----------|-------------|
| heldCardId | string | Card instance id in the hand array. |
| ownerPlayerId | string | Current holder. |
| cardType | enum | Rune type. |
| remainingHandRounds | number | Starts at 2; decreases on owner normal turns. |
| source | enum | DRAW or HONESTY_REWARD. |

## 12.3. BoardMarker

| **Field** | **Type** | **Meaning** |
|-----------|----------|-------------|
| markerId | string | Marker id. |
| cellId | string | Shared-track cell holding the marker. |
| cardType | enum | Secret Rune type. |
| realPlacerId | string | True placer; only server and the true placer use this for private tooltips. |
| displayedIdentityId | string | Public avatar identity. |
| remainingMarkerRounds | number | Starts at 3 or 5. |
| ttlMode | enum | DISPLAYED_IDENTITY_TURN or FULL_TABLE_ROUND. |
| createdAtPhaseId | string | Placement phase that created this instance. |

## 12.4. HorseState

| **Field** | **Type** | **Meaning** |
|-----------|----------|-------------|
| horseId | string | Horse id. |
| ownerPlayerId | string | Owner. |
| position | object | Stable, start, shared track, private home stretch, or finish. |
| hasShield | boolean | At most one Shield layer. |
| freezeOwnerTurnsRemaining | number | 0 or remaining locked normal turns; starts at 2 on Freeze. |

## 12.5. RunePlayerState

| **Field** | **Type** | **Meaning** |
|-----------|----------|-------------|
| drawCount | number | Random draws so far; max 25. |
| hand | HeldCard[] | Unexpired cards. Normal draw threshold under 5; rewards may append above. |
| hasClaimableHonestyReward | boolean | `true` when an honesty reward is due in the current normal turn’s draw/placement phase. Cleared after pick or timeout. |
| honestPlacementStreak | number | 0–5; at 5, create a reward due next normal turn; reset to 0 after receiving it. |

## 12.6. Main server events

| **Event** | **Meaning** |
|-----------|-------------|
| TURN_STARTED | Normal turn begins; expire held cards and update related TTL. |
| CARDS_DRAWN | Active player drew one or more cards. |
| PLACEMENT_PHASE_OPENED | Simultaneous placement open for marker cards. |
| MARKER_PLACE_REQUESTED | Client sends card instance, cellId, displayedIdentityId. |
| MARKER_PLACED | Server accepted the first marker on that cell. |
| MARKER_PLACE_REJECTED | Rejected (illegal or taken cell); held card kept. |
| LEAVE_STABLE_USED | Active player pressed Leave Stable; always consumes held card and resolves. |
| DICE_ROLLED | Active player rolled. |
| HORSE_STEP_MOVED | Horse hopped one cell; used for animation and marker resolve. |
| MARKER_TRIGGERED | Marker triggered and removed. |
| HORSE_STATUS_CHANGED | Apply or clear Shield, Freeze, send home, or swap. |
| HONESTY_REWARD_AVAILABLE | Honesty reward due in next normal turn’s draw/placement phase. |
| HONESTY_REWARD_SELECTED | Recipient picked a support card; on timeout server picks randomly. |
| HONESTY_REWARD_GRANTED | Append support card even at 5+; announce recipient, hide card type. |
| MARKER_EXPIRED | Marker TTL ended; remove from board. |
| HELD_CARD_EXPIRED | Held card past 2 rounds; remove from hand. |

# 13. Acceptance test scenarios

| **ID** | **Goal** | **Setup** | **Expected** |
|--------|----------|-----------|--------------|
| TC-01 | Personal draw limit | A has drawn 24 and has hand space. | A may draw at most 1 more card in the match. |
| TC-02 | Normal draw threshold | A holds 5 unexpired cards. | Normal draw locked. Honesty reward may still append. |
| TC-03 | Held card expiry | A draws now and does not place for the next 2 normal turns. | Card removed at the start of A’s third following normal turn. |
| TC-04 | Bonus turn from 6 | A rolls 6. | Only dice / choose / move repeats; no draw, no placement. |
| TC-05 | Marker place conflict | A and B place on the same empty cell. | Earlier request wins; later fails and keeps the card. |
| TC-06 | Advance stacking | Horse passes Advance 3 then Advance 2. | +5 bonus forward steps total. |
| TC-07 | Advance into Back | Forward horse with remaining steps hits Back 4. | Discard forward remainder; back 4. |
| TC-08 | Back into Back | Horse backing with 3 left hits Back 3. | Continue backing for 6 total. |
| TC-09 | Back into Advance | Backing horse hits Advance 3. | Discard remaining back; advance 3. |
| TC-10 | Shield blocks trap | Shielded horse hits Freeze. | Freeze removed; Shield removed; horse keeps remaining steps. |
| TC-11 | Second Shield | Shielded horse hits another Shield. | New Shield marker removed; still one layer. |
| TC-12 | Freeze | Unshielded horse hits Freeze. | Stops immediately; locked for owner’s next 2 normal turns. |
| TC-13 | Kick frozen horse | Frozen horse is kicked home. | Freeze clears immediately. |
| TC-14 | Leave Stable success | A has a stable horse; start empty; A presses Leave Stable before rolling. | One horse exits to start; card removed. |
| TC-15 | Leave Stable blocked by own horse | A has a stable horse but own horse occupies start. | No new exit; card still removed. |
| TC-16 | Leave Stable vs enemy | A has a stable horse; B occupies start. | A exits; B kicked home traditionally; card removed. |
| TC-17 | Leave Stable empty stable | A has no stable horses and presses Leave Stable. | No exit; card still removed. |
| TC-18 | Leave Stable triggers marker | Start empty but has a marker; Leave Stable succeeds. | A exits and marker resolves as a normal entry. |
| TC-19 | Multiple Leave Stable | A holds 2 Leave Stable and 2 stable horses; start empty. | First press exits one; second fails because A occupies start; both cards consumed. |
| TC-20 | Valid Swap | Horse A exact-stops on Swap spoofed as B; B has a shared-track horse. | A picks a legal B horse; positions swap. |
| TC-21 | Self-spoof Swap | Horse A exact-stops on Swap with displayed identity A. | No swap; marker still removed. |
| TC-22 | 3-round marker expiry | Untouched Advance marker. | Removed at start of displayed identity’s fourth following normal turn. |
| TC-23 | Displayed identity leaves | Marker still has TTL when displayed identity leaves. | Keep remainingTTL; switch to full-table round decay. |
| TC-24 | Honesty streak | A places honest markers for 5 placement turns; non-place turns in between. | Non-place keeps streak; reward due in A’s next normal draw/placement phase. |
| TC-25 | Spoof breaks streak | A has streak 4 then places at least one spoofed marker. | Streak returns to 0. |
| TC-26 | Win condition | A brings both horses home. | A wins under the new rule. |
| TC-27 | Reward above hand threshold | A holds 5 and receives a due honesty reward. | A picks 1 support card; hand becomes 6; normal draw stays locked. |
| TC-28 | Stacked rewards above threshold | A holds 6 and receives another reward. | New reward still appends; hand may reach 7+. |
| TC-29 | Choose reward | Reward due in A’s draw/placement phase. | A picks 1 of 5 support cards; others only see that A was rewarded. |
| TC-30 | Reward timeout | Reward due but A does not choose in time. | Server picks a random support card, appends, continues match. |
| TC-31 | Use reward immediately | A picks Advance 3 or Leave Stable as reward in the reward turn. | A may use it in the matching phase of the same turn. |
| TC-32 | Start new streak | A receives reward on turn 6 and places fully honest markers that phase. | After reward resets streak to 0, this turn counts as first honest turn of a new streak. |

# 14. Inherited scope, limits, and notes

## 14.1. Inherited traditional rules

Base Ludo/Parcheesi handling already in the MVP continues: dice rolls, horse selection, kicking opponents home on exact landings, and occupied start-cell handling. However, each player has only 2 horses and wins by bringing both home. Leave Stable follows Section 9.6 and fully replaces the older Leave Stable marker mechanism.

## 14.2. Do not add rules outside the lock

- Do not add new safe cells or Rune immunity.

- Do not add teammates in the MVP.

- Do not allow multiple markers on one cell.

- Never reveal the true placer.

- Do not allow markers on private home stretches or occupied cells.

- Do not keep Double Move in the new Rune list.

- Do not make Leave Stable a marker; it is direct-use from the hand only.

# APPENDIX A. Rule-lock summary

| **Item** | **Locked rule** |
|----------|-----------------|
| Draw quota | Max 25 random draws per player per match. |
| Hand array | Normal draws only under 5 unexpired cards; rewards may append above; all cards expire after the owner’s next 2 normal turns. |
| Bonus turn from 6 | Resume from dice only; no draw, placement, or Leave Stable. |
| Placement phase | Opens after active player draws; everyone places marker cards simultaneously with no per-phase place limit. |
| Legal cells | Shared track only; not occupied, not private home stretch, not already marked. |
| Cell conflict | Earlier server request wins; later fails and keeps the card. |
| Spoofing | Applies to every marker; not to Leave Stable. True placer never revealed. |
| Marker UI | Location circle + avatar + displayed-identity color; hide Rune type and TTL from others. |
| Marker TTL 3 | Advance, Shield, Back, Freeze. |
| Marker TTL 5 | Send Home, Swap. |
| TTL counting | By displayed identity’s normal turns; on leave/finish switch to full-table rounds. |
| Freeze | Stop immediately; lock for owner’s next 2 normal turns. |
| Shield | One layer; until next blocked trap or kick-home; blocks Back, Freeze, Send Home; not Swap. |
| Swap | Activator picks a legal shared-track horse of displayed identity; self-spoof has no effect. |
| Leave Stable | Direct use after placement, before dice; always consumed; no marker; may trigger start-cell markers. |
| Horses / win | 2 horses each; win by bringing both home. |
| Honesty reward | After 5 consecutive honest placements, reward due next normal turn; recipient picks 1 support card; timeout → random; append above 5; hide type from others. |

# APPENDIX B. Rune card artwork concept

Contact sheet for the official 11 Rune cards in a rounded 3D low-poly style — bright, friendly, simple icons. Concept art for visual alignment; production assets may be split and refined later.

<!-- Add artwork at docs/media/rune-cards-contact-sheet.png when available -->

Figure B.1. Rune card contact sheet: 5 support, 5 traps, and 1 special Swap card.
