import type { GameEvent, GameState } from '@rune-race/shared'
import { sliceNewEvents, type GameCommandResult } from './commands.js'
import { rollTurn, resolveTurn, syncCurrentPlayerIndex } from './engine.js'
import {
  drawCards,
  finishDrawPhase,
  isRuneDrawAndPlacePhase,
  isTokenFrozen,
} from './rune/turn-lifecycle.js'
import { placeMarker, closePlacementPhase, placementExpired } from './rune/placement.js'
import { resolveMoveWithRunes, resolveSwapChoice } from './rune/movement.js'

function fail(code: string, message: string): GameCommandResult {
  return { success: false, error: { code, message }, events: [] }
}

export function handleDrawCards(state: GameState, playerId: string, count: number): GameCommandResult {
  if (!state.config.runesEnabled || !state.rune) {
    return fail('RUNES_DISABLED', 'Rune system is not enabled')
  }
  if (state.status !== 'playing') return fail('GAME_NOT_PLAYING', 'Game is not active')
  if (state.turn.currentPlayerId !== playerId) return fail('NOT_YOUR_TURN', 'Not your turn')
  if (!isRuneDrawAndPlacePhase(state.turn.phase)) {
    return fail('INVALID_PHASE', 'Cannot draw in this phase')
  }

  const before = state
  const next = drawCards(state, playerId, count)
  if (next === before) return fail('DRAW_FAILED', 'Cannot draw cards')
  return { success: true, state: next, events: sliceNewEvents(before, next) }
}

export function handleFinishDraw(state: GameState, playerId: string): GameCommandResult {
  if (!state.config.runesEnabled) return fail('RUNES_DISABLED', 'Rune system is not enabled')
  if (state.turn.currentPlayerId !== playerId) return fail('NOT_YOUR_TURN', 'Not your turn')
  if (state.turn.phase !== 'waiting_draw') return fail('INVALID_PHASE', 'Cannot finish draw')

  const before = state
  const next = finishDrawPhase(state)
  return { success: true, state: next, events: sliceNewEvents(before, next) }
}

export function handlePlaceMarker(
  state: GameState,
  playerId: string,
  heldCardId: string,
  cellId: number,
  displayedIdentityId: string,
): GameCommandResult {
  if (!state.config.runesEnabled || !state.rune) {
    return fail('RUNES_DISABLED', 'Rune system is not enabled')
  }
  if (state.turn.phase !== 'placement_phase') return fail('INVALID_PHASE', 'Not in placement phase')

  const before = state
  const { state: next } = placeMarker(state, playerId, heldCardId, cellId, displayedIdentityId, Date.now())
  if (next === before) return fail('PLACE_FAILED', 'Could not place marker')
  return { success: true, state: next, events: sliceNewEvents(before, next) }
}

export function handleChooseSwap(
  state: GameState,
  playerId: string,
  targetTokenId: string,
): GameCommandResult {
  if (!state.config.runesEnabled) return fail('RUNES_DISABLED', 'Rune system is not enabled')
  if (state.turn.phase !== 'waiting_swap_choice') return fail('INVALID_PHASE', 'No swap pending')

  const before = state
  const next = resolveSwapChoice(state, playerId, targetTokenId)
  if (next === before) return fail('SWAP_FAILED', 'Invalid swap target')
  return { success: true, state: next, events: sliceNewEvents(before, next) }
}

export function prepareRollWithRunes(state: GameState, playerId: string): GameState | GameCommandResult {
  if (!state.config.runesEnabled) return state
  if (state.turn.currentPlayerId !== playerId) return fail('NOT_YOUR_TURN', 'Not your turn')

  const timestamp = Date.now()
  let next = state

  if (next.turn.phase === 'waiting_draw') {
    next = {
      ...next,
      version: next.version + 1,
      turn: { ...next.turn, phase: 'waiting_roll', diceResult: null, legalMoves: [], pendingSwap: null },
      phase: 'waiting_roll',
      updatedAt: timestamp,
    }
  }

  if (next.turn.phase === 'placement_phase' && next.rune?.placement) {
    next = closePlacementPhase(next, timestamp)
    next = syncCurrentPlayerIndex({
      ...next,
      version: next.version + 1,
      updatedAt: timestamp,
    })
  }

  if (next.turn.phase !== 'waiting_roll') {
    return fail('INVALID_PHASE', `Cannot roll in ${next.turn.phase}`)
  }

  return next
}

export function rollTurnWithRunes(
  state: GameState,
  playerId: string,
  rollFn?: Parameters<typeof rollTurn>[1],
): GameCommandResult {
  const prepared = prepareRollWithRunes(state, playerId)
  if ('success' in prepared && !prepared.success) return prepared
  const readyState = prepared as GameState

  const before = readyState
  let next = rollTurn(readyState, rollFn)

  if (next.turn.phase === 'waiting_choice' && next.turn.legalMoves.length === 1) {
    next = resolveTurnWithRunesIfEnabled(next, next.turn.legalMoves[0]!.id)
  } else if (next.turn.phase === 'rolled') {
    next = resolveTurnWithRunesIfEnabled(next)
  }

  return { success: true, state: next, events: sliceNewEvents(before, next) }
}

export function resolveTurnWithRunesIfEnabled(state: GameState, moveId?: string): GameState {
  if (!state.config.runesEnabled || !state.rune) {
    return resolveTurn(state, moveId)
  }

  const diceResult = state.turn.diceResult
  if (diceResult === null) return state

  const legalMoves = state.turn.legalMoves.length > 0 ? state.turn.legalMoves : []
  const chosenMove = moveId ? legalMoves.find((m) => m.id === moveId) ?? null : legalMoves[0] ?? null

  if (state.turn.phase === 'waiting_choice' && legalMoves.length > 1 && !chosenMove) {
    return state
  }

  if (!chosenMove) {
    return resolveTurn(state, moveId)
  }

  return resolveMoveWithRunes(state, chosenMove)
}

export function chooseMoveWithRunes(
  state: GameState,
  playerId: string,
  moveId: string,
): GameCommandResult {
  if (state.status !== 'playing') return fail('GAME_NOT_PLAYING', 'Game is not active')
  if (state.turn.currentPlayerId !== playerId) return fail('NOT_YOUR_TURN', 'Not your turn')
  if (state.turn.phase !== 'waiting_choice') return fail('INVALID_PHASE', 'Cannot choose move')

  const legal = state.turn.legalMoves.find((m) => m.id === moveId)
  if (!legal) return fail('INVALID_MOVE', 'Move is not legal')

  const moveToken = state.tokens.find((t) => t.id === legal.tokenId)
  if (state.config.runesEnabled && moveToken && isTokenFrozen(moveToken)) {
    return fail('TOKEN_FROZEN', 'This token is frozen')
  }

  const before = state
  const next = state.config.runesEnabled
    ? resolveMoveWithRunes(state, legal)
    : resolveTurn(state, moveId)

  if (next === before) {
    return fail('MOVE_FAILED', 'Move could not be resolved')
  }

  return { success: true, state: next, events: sliceNewEvents(before, next) }
}
