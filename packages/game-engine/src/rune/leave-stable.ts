import type { GameEvent, GameState } from '@rune-race/shared'
import { getRunePlayer } from './state.js'
import { applySpawnFromBaseWithMarkers } from './movement.js'

export function playerHasLeaveStableCard(state: GameState, playerId: string): boolean {
  const player = getRunePlayer(state, playerId)
  return Boolean(player?.hand.some((card) => card.cardType === 'LEAVE_STABLE'))
}

/** True when using LEAVE_STABLE would spawn a horse (tokens in base, no own horse on start cell). */
export function canSpawnFromLeaveStable(state: GameState, playerId: string): boolean {
  const inBase = state.tokens.filter((token) => token.playerId === playerId && token.state === 'in_base')
  if (inBase.length === 0) return false
  const ownAtStart = state.tokens.some(
    (token) => token.playerId === playerId && token.state === 'on_track' && token.position === 0,
  )
  return !ownAtStart
}

export function purgeLegacyLeaveStableMarkers(state: GameState): GameState {
  if (!state.rune) return state
  const markers = state.rune.markers.filter((marker) => marker.cardType !== 'LEAVE_STABLE')
  if (markers.length === state.rune.markers.length) return state
  return { ...state, rune: { ...state.rune, markers } }
}

export function openLeaveStablePhase(state: GameState, timestamp: number): GameState {
  return {
    ...state,
    version: state.version + 1,
    turn: { ...state.turn, phase: 'leave_stable_phase' },
    phase: 'leave_stable_phase',
    updatedAt: timestamp,
  }
}

export function closeLeaveStablePhase(state: GameState, timestamp: number): GameState {
  return {
    ...state,
    version: state.version + 1,
    turn: { ...state.turn, phase: 'waiting_roll', diceResult: null, legalMoves: [], pendingSwap: null },
    phase: 'waiting_roll',
    updatedAt: timestamp,
  }
}

export type LeaveStableOutcome = 'spawned' | 'empty_base' | 'own_at_start'

function leaveStableUsedEvent(
  timestamp: number,
  playerId: string,
  heldCardId: string,
  outcome: LeaveStableOutcome,
): GameEvent {
  return {
    type: 'leave_stable_used',
    timestamp,
    playerId,
    details: { heldCardId, outcome },
  }
}

export function useLeaveStableCard(
  state: GameState,
  playerId: string,
  heldCardId: string,
  timestamp: number,
): { state: GameState; outcome: LeaveStableOutcome } {
  if (!state.rune) return { state, outcome: 'empty_base' }
  if (state.turn.phase !== 'leave_stable_phase') return { state, outcome: 'empty_base' }
  if (state.turn.currentPlayerId !== playerId) return { state, outcome: 'empty_base' }

  const player = getRunePlayer(state, playerId)
  const card = player?.hand.find((entry) => entry.heldCardId === heldCardId)
  if (!card || card.cardType !== 'LEAVE_STABLE') return { state, outcome: 'empty_base' }

  const newHand = player!.hand.filter((entry) => entry.heldCardId !== heldCardId)
  let next: GameState = {
    ...state,
    version: state.version + 1,
    rune: {
      ...state.rune,
      players: {
        ...state.rune.players,
        [playerId]: { ...player!, hand: newHand },
      },
    },
    updatedAt: timestamp,
  }

  const inBase = next.tokens.filter((token) => token.playerId === playerId && token.state === 'in_base')
  if (inBase.length === 0) {
    return {
      state: {
        ...next,
        events: [...next.events, leaveStableUsedEvent(timestamp, playerId, heldCardId, 'empty_base')],
      },
      outcome: 'empty_base',
    }
  }

  const ownAtStart = next.tokens.some(
    (token) => token.playerId === playerId && token.state === 'on_track' && token.position === 0,
  )
  if (ownAtStart) {
    return {
      state: {
        ...next,
        events: [...next.events, leaveStableUsedEvent(timestamp, playerId, heldCardId, 'own_at_start')],
      },
      outcome: 'own_at_start',
    }
  }

  next = applySpawnFromBaseWithMarkers(next, playerId, timestamp)
  return {
    state: {
      ...next,
      events: [...next.events, leaveStableUsedEvent(timestamp, playerId, heldCardId, 'spawned')],
    },
    outcome: 'spawned',
  }
}
