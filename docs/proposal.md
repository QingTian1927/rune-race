# Game concept: Enhanced Ludo / Parcheesi (online)

## Core rules

Traditional rules stay in place:

- Each player has 4 horses, starting in the stable
- Each turn, roll one die and move that many cells clockwise
- A roll of 6 is required to leave the stable (unless a leave-stable support card is used)
- Rolling a 6 grants an extra turn
- Landing exactly on an opponent’s horse sends that horse back to the stable
- Star cells are safe — horses there cannot be kicked home
- The colored home stretch is private to that player; horses there cannot be kicked
- Exact remaining steps are required to enter the finish; overshooting means you cannot enter
- Win by bringing all 4 horses home before opponents
- Horses move independently; players do not interact directly as pieces
- Cards can be picked up along the track and used

## Support cards

- Leave stable (stepping on the leave-stable cell exits immediately, no extra condition)
- Double move
- Shield (protection)

## Trap cards (placed on the track to hinder opponents)

- Freeze
- Send home immediately
- Step back

## Special card — Swap positions

- Fully reverses the situation
- Must be used immediately when drawn; cannot be held
- Expires after one round if nobody triggers it

### Card notes

- Ordinary cards: held for at most one round; unused cards are discarded
- Send-home and swap only matter when placed at a strategic cell

## Draw mechanism

- Each match allows at most 25 card draws (shared across all players)
- On your turn you may draw as many as you want while the match total stays within 25
- Drawn cards may be kept for a later turn

## Simultaneous placement

- Cards are drawn in turn order, but placement happens for everyone who still holds cards at once
- Example: A draws 3, places 2, keeps 1. When B finishes drawing and places, A may also place the remaining card at the same time; C and D do the same if they still hold cards
- Creates noise and makes it hard to predict who placed what where

## Spoofed identity (online twist)

- When placing a trap, the placer may point the displayed name at another player instead of their real identity
- Builds mutual suspicion, especially when many players place cards together
- Example: A places a trap at B’s stable gate but shows C as the placer — frustration and information chaos follow

## Technical direction

- Online game, 3D graphics (camera setup is the hardest part)
