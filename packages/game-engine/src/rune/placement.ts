import type { BoardMarker, GameEvent, GameState } from '@rune-race/shared'
import {
  isBoardMarkerCardType,
  RUNE_CARD_DEFINITIONS,
  RUNE_HONESTY_STREAK_FOR_REWARD,
  RUNE_PLACEMENT_MAX_MS,
  RUNE_PLACEMENT_MIN_MS,
} from '@rune-race/shared'
import { drawHonestyRewardType } from './deck.js'
import {
  closeLeaveStablePhase,
  openLeaveStablePhase,
  playerHasLeaveStableCard,
} from './leave-stable.js'
import { isDisplayIdentityEligible } from './player-eligibility.js'
import { getRunePlayer } from './state.js'
import { listValidPlacementCellIds, markerAtCell } from './board-cells.js'

export function openPlacementPhase(state: GameState, timestamp: number): GameState {
  if (!state.rune) return state
  const phaseId = `${state.turn.id}:placement:${timestamp}`
  const placement = {
    phaseId,
    openedAt: timestamp,
    minCloseAt: timestamp + RUNE_PLACEMENT_MIN_MS,
    maxCloseAt: timestamp + RUNE_PLACEMENT_MAX_MS,
    honestyByPlayer: {},
    readyByPlayer: {},
  }
  const events: GameEvent[] = [
    ...state.events,
    {
      type: 'placement_phase_opened',
      timestamp,
      playerId: state.turn.currentPlayerId,
      details: { phaseId, minCloseAt: placement.minCloseAt, maxCloseAt: placement.maxCloseAt },
    },
  ]
  return {
    ...state,
    turn: { ...state.turn, phase: 'placement_phase' },
    phase: 'placement_phase',
    rune: { ...state.rune, placement },
    events,
  }
}

function transitionAfterPlacementClosed(state: GameState, timestamp: number): GameState {
  const activePlayerId = state.turn.currentPlayerId
  const clearedPlacement = { ...state.rune!, placement: null }

  if (playerHasLeaveStableCard({ ...state, rune: clearedPlacement }, activePlayerId)) {
    return openLeaveStablePhase(
      {
        ...state,
        rune: clearedPlacement,
      },
      timestamp,
    )
  }

  return {
    ...state,
    version: state.version + 1,
    turn: { ...state.turn, phase: 'waiting_roll', diceResult: null, legalMoves: [], pendingSwap: null },
    phase: 'waiting_roll',
    rune: clearedPlacement,
    updatedAt: timestamp,
  }
}

export function closePlacementPhase(state: GameState, timestamp: number): GameState {
  if (!state.rune?.placement) return state

  let next = state
  const honestyByPlayer = state.rune.placement.honestyByPlayer

  for (const [playerId, flags] of Object.entries(honestyByPlayer)) {
    const player = state.rune.players[playerId]
    if (!player) continue

    if (flags.usedImpersonation) {
      next = {
        ...next,
        rune: {
          ...next.rune!,
          players: {
            ...next.rune!.players,
            [playerId]: { ...player, honestPlacementStreak: 0 },
          },
        },
      }
      continue
    }

    if (flags.placedCount > 0) {
      const newStreak = player.honestPlacementStreak + 1
      if (newStreak >= RUNE_HONESTY_STREAK_FOR_REWARD) {
        const rewardType = drawHonestyRewardType()
        const pending = [...player.pendingRewards, rewardType]
        next = {
          ...next,
          events: [
            ...next.events,
            {
              type: 'honesty_reward_granted',
              timestamp,
              playerId,
              details: { playerId, cardType: rewardType, queued: true },
            },
          ],
          rune: {
            ...next.rune!,
            players: {
              ...next.rune!.players,
              [playerId]: { ...player, honestPlacementStreak: 0, pendingRewards: pending },
            },
          },
        }
      } else {
        next = {
          ...next,
          rune: {
            ...next.rune!,
            players: {
              ...next.rune!.players,
              [playerId]: { ...player, honestPlacementStreak: newStreak },
            },
          },
        }
      }
    }
  }

  return transitionAfterPlacementClosed(next, timestamp)
}

export function allPlayersPlacementReady(state: GameState): boolean {
  const placement = state.rune?.placement
  if (!placement) return false
  return state.players.every((player) => placement.readyByPlayer[player.id] === true)
}

export function canClosePlacementEarly(state: GameState, now: number): boolean {
  const placement = state.rune?.placement
  if (!placement) return false
  return now >= placement.minCloseAt && allPlayersPlacementReady(state)
}

export function placementExpired(state: GameState, now: number): boolean {
  const placement = state.rune?.placement
  if (!placement) return false
  return now >= placement.maxCloseAt
}

export function maybeClosePlacementWhenAllReady(state: GameState, timestamp: number): GameState {
  if (state.turn.phase !== 'placement_phase' || !state.rune?.placement) return state
  if (!canClosePlacementEarly(state, timestamp)) return state
  return closePlacementPhase(state, timestamp)
}

export function maybeAutoCloseExpiredPlacement(state: GameState, timestamp: number): GameState {
  if (state.turn.phase !== 'placement_phase' || !state.rune?.placement) return state
  if (!placementExpired(state, timestamp)) return state

  return closePlacementPhase(state, timestamp)
}

export function confirmPlacementReady(
  state: GameState,
  playerId: string,
  timestamp: number,
): GameState {
  if (state.turn.phase !== 'placement_phase' || !state.rune?.placement) return state
  if (!state.players.some((p) => p.id === playerId)) return state

  const placement = state.rune.placement
  if (placement.readyByPlayer[playerId]) return state

  const events: GameEvent[] = [
    ...state.events,
    {
      type: 'placement_ready_confirmed',
      timestamp,
      playerId,
      details: { phaseId: placement.phaseId },
    },
  ]

  const next: GameState = {
    ...state,
    version: state.version + 1,
    events,
    rune: {
      ...state.rune,
      placement: {
        ...placement,
        readyByPlayer: { ...placement.readyByPlayer, [playerId]: true },
      },
    },
    updatedAt: timestamp,
  }

  return maybeClosePlacementWhenAllReady(next, timestamp)
}

export function tickPlacementPhase(state: GameState, timestamp: number): GameState {
  let next = maybeAutoCloseExpiredPlacement(state, timestamp)
  if (next.turn.phase === 'placement_phase') {
    next = maybeClosePlacementWhenAllReady(next, timestamp)
  }
  return next
}

export function placeMarker(
  state: GameState,
  playerId: string,
  heldCardId: string,
  cellId: number,
  displayedIdentityId: string,
  timestamp: number,
): { state: GameState; events: GameEvent[] } {
  if (!state.rune || state.turn.phase !== 'placement_phase') {
    return {
      state,
      events: [
        {
          type: 'marker_place_rejected',
          timestamp,
          playerId,
          details: { reason: 'invalid_phase' },
        },
      ],
    }
  }

  const player = getRunePlayer(state, playerId)
  if (!player) {
    return { state, events: [{ type: 'marker_place_rejected', timestamp, playerId, details: { reason: 'not_in_game' } }] }
  }

  if (state.rune.placement?.readyByPlayer?.[playerId]) {
    return {
      state,
      events: [
        {
          type: 'marker_place_rejected',
          timestamp,
          playerId,
          details: { reason: 'placement_confirmed' },
        },
      ],
    }
  }

  const card = player.hand.find((c) => c.heldCardId === heldCardId)
  if (!card) {
    return { state, events: [{ type: 'marker_place_rejected', timestamp, playerId, details: { reason: 'card_not_found' } }] }
  }

  if (!isBoardMarkerCardType(card.cardType)) {
    return {
      state,
      events: [{ type: 'marker_place_rejected', timestamp, playerId, details: { reason: 'not_placable' } }],
    }
  }

  if (!isDisplayIdentityEligible(state, displayedIdentityId)) {
    return { state, events: [{ type: 'marker_place_rejected', timestamp, playerId, details: { reason: 'invalid_identity' } }] }
  }

  const validCells = listValidPlacementCellIds(state)
  if (!validCells.includes(cellId)) {
    return { state, events: [{ type: 'marker_place_rejected', timestamp, playerId, details: { reason: 'invalid_cell', cellId } }] }
  }

  if (markerAtCell(state.rune.markers, cellId)) {
    return {
      state,
      events: [{ type: 'marker_place_rejected', timestamp, playerId, details: { reason: 'cell_taken', cellId } }],
    }
  }

  const def = RUNE_CARD_DEFINITIONS[card.cardType]
  if (!def.markerTTL) {
    return {
      state,
      events: [{ type: 'marker_place_rejected', timestamp, playerId, details: { reason: 'not_placable' } }],
    }
  }

  // version đảm bảo id duy nhất kể cả khi cùng ô được đặt lại trong cùng một mili-giây
  const markerId = `marker-${state.roomId}-${cellId}-${timestamp}-v${state.version}`
  const marker: BoardMarker = {
    markerId,
    cellId,
    cardType: card.cardType,
    realPlacerId: playerId,
    displayedIdentityId,
    remainingMarkerRounds: def.markerTTL,
    ttlMode: 'DISPLAYED_IDENTITY_TURN',
    createdAtPhaseId: state.rune.placement?.phaseId ?? 'unknown',
  }

  const newHand = player.hand.filter((c) => c.heldCardId !== heldCardId)
  const markers = [...state.rune.markers, marker]

  const honestyFlags = state.rune.placement?.honestyByPlayer[playerId] ?? {
    placedCount: 0,
    usedImpersonation: false,
  }
  const updatedHonesty = {
    placedCount: honestyFlags.placedCount + 1,
    usedImpersonation:
      honestyFlags.usedImpersonation || displayedIdentityId !== playerId,
  }

  const next: GameState = {
    ...state,
    version: state.version + 1,
    rune: {
      ...state.rune,
      markers,
      placement: state.rune.placement
        ? {
            ...state.rune.placement,
            honestyByPlayer: {
              ...state.rune.placement.honestyByPlayer,
              [playerId]: updatedHonesty,
            },
          }
        : null,
      players: {
        ...state.rune.players,
        [playerId]: { ...player, hand: newHand },
      },
    },
    events: [
      ...state.events,
      {
        type: 'marker_placed',
        timestamp,
        playerId,
        details: { markerId, cellId, displayedIdentityId, heldCardId },
      },
    ],
  }

  return { state: next, events: next.events.slice(state.events.length) }
}

export { closeLeaveStablePhase }
