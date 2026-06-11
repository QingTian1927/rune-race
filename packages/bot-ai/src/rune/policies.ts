import type { BotProfile, GameState, HeldCard, RuneCardType } from '@rune-race/shared'
import {
  isBoardMarkerCardType,
  RUNE_CARD_DEFINITIONS,
  RUNE_MAX_DRAW_PER_PLAYER,
  RUNE_MAX_HAND_SIZE,
} from '@rune-race/shared'
import {
  boardSlotForPlayer,
  canSpawnFromLeaveStable,
  listValidPlacementCellIds,
  absoluteTrackIndexFor,
  BOARD_TRACK_LENGTH,
} from '@rune-race/game-engine'
import type { Rng } from '../types.js'

export interface PlacementDecision {
  heldCardId: string
  cellId: number
  displayedIdentityId: string
}

function runePlayer(state: GameState, playerId: string) {
  return state.rune?.players[playerId] ?? null
}

function placeableCards(hand: HeldCard[]): HeldCard[] {
  return hand.filter((card) => isBoardMarkerCardType(card.cardType))
}

function isTrap(cardType: RuneCardType): boolean {
  const category = RUNE_CARD_DEFINITIONS[cardType].category
  return category === 'TRAP' || category === 'SPECIAL'
}

/** Should the bot draw another rune card during placement phase (active player only)? */
export function shouldDrawCard(
  state: GameState,
  playerId: string,
  profile: BotProfile,
  rng: Rng = Math.random,
): boolean {
  const player = runePlayer(state, playerId)
  if (!player) return false
  if (player.pendingDraw) return false
  if (player.hand.length >= RUNE_MAX_HAND_SIZE) return false
  if (player.drawCount >= RUNE_MAX_DRAW_PER_PLAYER) return false

  if (profile === 'simple') {
    if (player.hand.length === 0) return true
    return rng() < 0.3
  }
  if (player.hand.length < 3) return rng() < 0.85
  return rng() < 0.2
}

/** Track cells 1..6 ahead of the given on-track tokens, in absolute cell ids. */
function cellsAheadOfTokens(
  state: GameState,
  predicate: (token: GameState['tokens'][number]) => boolean,
): Set<number> {
  const cells = new Set<number>()
  for (const token of state.tokens) {
    if (token.state !== 'on_track' || !predicate(token)) continue
    const slot = boardSlotForPlayer(state, token.playerId)
    if (slot < 0) continue
    for (let step = 1; step <= 6; step += 1) {
      const progress = token.position + step
      if (progress >= BOARD_TRACK_LENGTH) break
      cells.add(absoluteTrackIndexFor(slot, progress))
    }
  }
  return cells
}

function pickIdentity(
  state: GameState,
  playerId: string,
  impersonate: boolean,
  rng: Rng,
): string {
  if (!impersonate) return playerId
  const others = state.players.filter((p) => p.id !== playerId)
  if (others.length === 0) return playerId
  return others[Math.floor(rng() * others.length)]!.id
}

/**
 * Decide which card to place where during placement phase.
 * Returns null when the bot prefers to hold its cards.
 */
export function decidePlacement(
  state: GameState,
  playerId: string,
  profile: BotProfile,
  rng: Rng = Math.random,
): PlacementDecision | null {
  const player = runePlayer(state, playerId)
  if (!player) return null

  const cards = placeableCards(player.hand)
  if (cards.length === 0) return null

  const validCells = listValidPlacementCellIds(state)
  if (validCells.length === 0) return null

  if (profile === 'simple') {
    if (rng() > 0.75) return null
    const card = cards[Math.floor(rng() * cards.length)]!
    const cellId = validCells[Math.floor(rng() * validCells.length)]!
    const impersonate = isTrap(card.cardType) && rng() < 0.35
    return {
      heldCardId: card.heldCardId,
      cellId,
      displayedIdentityId: pickIdentity(state, playerId, impersonate, rng),
    }
  }

  // Complex: traps go in front of enemy horses, support in front of our own.
  const validSet = new Set(validCells)
  const enemyAhead = [...cellsAheadOfTokens(state, (t) => t.playerId !== playerId)].filter((c) =>
    validSet.has(c),
  )
  const ownAhead = [...cellsAheadOfTokens(state, (t) => t.playerId === playerId)].filter((c) =>
    validSet.has(c),
  )

  // Cards expire after a round — prioritize the one expiring soonest.
  const sorted = [...cards].sort((a, b) => a.remainingHandRounds - b.remainingHandRounds)
  for (const card of sorted) {
    const trap = isTrap(card.cardType)
    const targetCells = trap ? enemyAhead : ownAhead
    if (targetCells.length === 0) continue
    const cellId = targetCells[Math.floor(rng() * targetCells.length)]!
    const impersonate = trap && rng() < 0.7
    return {
      heldCardId: card.heldCardId,
      cellId,
      displayedIdentityId: pickIdentity(state, playerId, impersonate, rng),
    }
  }

  // No strategic spot: place a card about to expire anywhere rather than waste it.
  const expiring = sorted.find((card) => card.remainingHandRounds <= 1)
  if (expiring) {
    const cellId = validCells[Math.floor(rng() * validCells.length)]!
    return { heldCardId: expiring.heldCardId, cellId, displayedIdentityId: playerId }
  }

  return null
}

/** Pick a LEAVE_STABLE card to use during leave_stable_phase, or null to just roll. */
export function decideLeaveStableCard(
  state: GameState,
  playerId: string,
  profile: BotProfile,
  rng: Rng = Math.random,
): HeldCard | null {
  const player = runePlayer(state, playerId)
  if (!player) return null

  const card = player.hand.find((c) => c.cardType === 'LEAVE_STABLE')
  if (!card) return null
  if (!canSpawnFromLeaveStable(state, playerId)) return null

  if (profile === 'simple') return card

  const onBoard = state.tokens.filter(
    (t) => t.playerId === playerId && (t.state === 'on_track' || t.state === 'in_home_lane'),
  ).length
  if (onBoard === 0) return card
  if (card.remainingHandRounds <= 1) return card
  return rng() < 0.5 ? card : null
}
