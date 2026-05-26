import type { GameEvent, GameState } from '@rune-race/shared'
import { removePlayerFromGame, rollTurn, resolveTurn, type RollDiceFn } from './engine'

export type GameCommandError = {
  code: string
  message: string
}

export type GameCommandResult =
  | { success: true; state: GameState; events: GameEvent[] }
  | { success: false; error: GameCommandError; events: [] }

export function sliceNewEvents(before: GameState, after: GameState): GameEvent[] {
  return after.events.slice(before.events.length)
}

export function handleRoll(
  state: GameState,
  playerId: string,
  rollFn?: RollDiceFn,
): GameCommandResult {
  if (state.status !== 'playing') {
    return { success: false, error: { code: 'GAME_NOT_PLAYING', message: 'Game is not active' }, events: [] }
  }
  if (state.turn.currentPlayerId !== playerId) {
    return { success: false, error: { code: 'NOT_YOUR_TURN', message: 'Not your turn' }, events: [] }
  }
  if (state.turn.phase !== 'waiting_roll') {
    return {
      success: false,
      error: { code: 'INVALID_PHASE', message: `Cannot roll in ${state.turn.phase}` },
      events: [],
    }
  }

  const before = state
  let next = rollTurn(state, rollFn)

  if (next.turn.phase === 'waiting_choice' && next.turn.legalMoves.length === 1) {
    next = resolveTurn(next, next.turn.legalMoves[0].id)
  } else if (next.turn.phase === 'rolled') {
    next = resolveTurn(next)
  }

  return {
    success: true,
    state: next,
    events: sliceNewEvents(before, next),
  }
}

export function handlePlayerLeft(state: GameState, playerId: string): GameCommandResult {
  if (state.status === 'finished') {
    return { success: false, error: { code: 'GAME_FINISHED', message: 'Game already finished' }, events: [] }
  }
  if (!state.players.some((p) => p.id === playerId)) {
    return { success: false, error: { code: 'NOT_IN_GAME', message: 'Player not in game' }, events: [] }
  }

  const before = state
  const next = removePlayerFromGame(state, playerId)

  return {
    success: true,
    state: next,
    events: sliceNewEvents(before, next),
  }
}

export function handleChooseMove(
  state: GameState,
  playerId: string,
  moveId: string,
): GameCommandResult {
  if (state.status !== 'playing') {
    return { success: false, error: { code: 'GAME_NOT_PLAYING', message: 'Game is not active' }, events: [] }
  }
  if (state.turn.currentPlayerId !== playerId) {
    return { success: false, error: { code: 'NOT_YOUR_TURN', message: 'Not your turn' }, events: [] }
  }
  if (state.turn.phase !== 'waiting_choice') {
    return {
      success: false,
      error: { code: 'INVALID_PHASE', message: `Cannot choose move in ${state.turn.phase}` },
      events: [],
    }
  }

  const legal = state.turn.legalMoves.find((m) => m.id === moveId)
  if (!legal) {
    return { success: false, error: { code: 'INVALID_MOVE', message: 'Move is not legal' }, events: [] }
  }

  const before = state
  const next = resolveTurn(state, moveId)

  return {
    success: true,
    state: next,
    events: sliceNewEvents(before, next),
  }
}
