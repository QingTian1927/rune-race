import type { GameEvent, GameState, RuneCardType } from '@rune-race/shared'
import { RUNE_HONESTY_REWARD_TYPES } from '@rune-race/shared'
import { pickAutoSpawnMove, shouldAutoExitStable } from './engine.js'
import { sliceNewEvents, type GameCommandResult } from './commands.js'
import { rollTurn, resolveTurn } from './engine.js'
import {
  finishDrawPhase,
  confirmPendingDraw,
  previewDrawCard,
  flushPendingDraw,
  isRuneDrawAndPlacePhase,
  isTokenFrozen,
} from './rune/turn-lifecycle.js'
import {
  placeMarker,
  confirmPlacementReady,
  maybeAutoCloseExpiredPlacement,
  tickPlacementPhase,
  closeLeaveStablePhase,
} from './rune/placement.js'
import { canSpawnFromLeaveStable, useLeaveStableCard } from './rune/leave-stable.js'
import { resolveMoveWithRunes, resolveSwapChoice } from './rune/movement.js'
import { getRunePlayer, grantHonestyReward } from './rune/state.js'

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

  if (count !== 1) {
    return fail('INVALID_COUNT', 'Draw one card at a time')
  }

  const timestamp = Date.now()
  const before = maybeAutoCloseExpiredPlacement(state, timestamp)
  if (before.turn.phase !== 'placement_phase' && before.turn.phase !== 'waiting_draw') {
    return fail('INVALID_PHASE', 'Cannot draw in this phase')
  }
  if (
    before.turn.phase === 'placement_phase' &&
    before.rune?.placement?.readyByPlayer?.[playerId]
  ) {
    return fail('PLACEMENT_CONFIRMED', 'Placement already confirmed')
  }

  const next = previewDrawCard(before, playerId)
  if (next === before) return fail('DRAW_FAILED', 'Cannot draw cards')
  return { success: true, state: next, events: sliceNewEvents(before, next) }
}

export function handleConfirmDraw(state: GameState, playerId: string): GameCommandResult {
  if (!state.config.runesEnabled || !state.rune) {
    return fail('RUNES_DISABLED', 'Rune system is not enabled')
  }
  if (state.status !== 'playing') return fail('GAME_NOT_PLAYING', 'Game is not active')
  if (state.turn.currentPlayerId !== playerId) return fail('NOT_YOUR_TURN', 'Not your turn')
  if (!isRuneDrawAndPlacePhase(state.turn.phase)) {
    return fail('INVALID_PHASE', 'Cannot confirm draw in this phase')
  }

  const timestamp = Date.now()
  const before = maybeAutoCloseExpiredPlacement(state, timestamp)
  if (
    before.turn.phase === 'placement_phase' &&
    before.rune?.placement?.readyByPlayer?.[playerId]
  ) {
    return fail('PLACEMENT_CONFIRMED', 'Placement already confirmed')
  }
  const next = confirmPendingDraw(before, playerId)
  if (next === before) return fail('CONFIRM_DRAW_FAILED', 'No pending draw to confirm')
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

  const timestamp = Date.now()
  const before = maybeAutoCloseExpiredPlacement(state, timestamp)
  if (before.turn.phase !== 'placement_phase') {
    return fail('INVALID_PHASE', 'Placement phase has closed')
  }

  const { state: next } = placeMarker(before, playerId, heldCardId, cellId, displayedIdentityId, timestamp)
  if (next === before) return fail('PLACE_FAILED', 'Could not place marker')
  return { success: true, state: next, events: sliceNewEvents(before, next) }
}

export function handleConfirmPlacementReady(state: GameState, playerId: string): GameCommandResult {
  if (!state.config.runesEnabled || !state.rune) {
    return fail('RUNES_DISABLED', 'Rune system is not enabled')
  }
  if (state.status !== 'playing') return fail('GAME_NOT_PLAYING', 'Game is not active')
  if (state.turn.phase !== 'placement_phase') return fail('INVALID_PHASE', 'Not in placement phase')
  if (!state.players.some((p) => p.id === playerId)) {
    return fail('NOT_IN_GAME', 'Player not in game')
  }

  const timestamp = Date.now()
  const before = maybeAutoCloseExpiredPlacement(state, timestamp)
  if (before.turn.phase !== 'placement_phase') {
    return fail('PLACEMENT_CLOSED', 'Placement phase already closed')
  }

  const next = confirmPlacementReady(before, playerId, timestamp)
  return { success: true, state: next, events: sliceNewEvents(before, next) }
}

export { tickPlacementPhase }

/** Claim the honesty-streak reward by picking one of the 5 support cards (spec §4.4). */
export function handleSelectHonestyReward(
  state: GameState,
  playerId: string,
  cardType: RuneCardType,
): GameCommandResult {
  if (!state.config.runesEnabled || !state.rune) {
    return fail('RUNES_DISABLED', 'Rune system is not enabled')
  }
  if (state.status !== 'playing') return fail('GAME_NOT_PLAYING', 'Game is not active')
  if (state.turn.currentPlayerId !== playerId) return fail('NOT_YOUR_TURN', 'Not your turn')
  if (!RUNE_HONESTY_REWARD_TYPES.includes(cardType)) {
    return fail('INVALID_REWARD_TYPE', 'Not a support card')
  }
  if (!isRuneDrawAndPlacePhase(state.turn.phase)) {
    return fail('INVALID_PHASE', 'Reward can only be claimed during draw & placement')
  }

  const timestamp = Date.now()
  const before = maybeAutoCloseExpiredPlacement(state, timestamp)
  if (!isRuneDrawAndPlacePhase(before.turn.phase)) {
    return fail('INVALID_PHASE', 'Draw & placement phase has closed')
  }
  if (!getRunePlayer(before, playerId)?.hasClaimableHonestyReward) {
    return fail('NO_CLAIMABLE_REWARD', 'No honesty reward to claim')
  }

  const granted = grantHonestyReward(before, playerId, cardType, timestamp, {
    autoSelected: false,
  })
  if (granted === before) return fail('REWARD_SELECT_FAILED', 'Could not grant reward')

  const next = { ...granted, version: granted.version + 1, updatedAt: timestamp }
  return { success: true, state: next, events: sliceNewEvents(before, next) }
}

export function handleUseLeaveStable(
  state: GameState,
  playerId: string,
  heldCardId: string,
): GameCommandResult {
  if (!state.config.runesEnabled || !state.rune) {
    return fail('RUNES_DISABLED', 'Rune system is not enabled')
  }
  if (state.status !== 'playing') return fail('GAME_NOT_PLAYING', 'Game is not active')
  if (state.turn.currentPlayerId !== playerId) return fail('NOT_YOUR_TURN', 'Not your turn')

  if (state.turn.phase !== 'leave_stable_phase') {
    return fail('INVALID_PHASE', 'Not in leave stable phase')
  }

  const before = state
  const { state: next } = useLeaveStableCard(state, playerId, heldCardId, Date.now())
  if (next === before) return fail('LEAVE_STABLE_FAILED', 'Could not use leave stable card')
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
  const startedInLeaveStable = state.turn.phase === 'leave_stable_phase'
  let next = maybeAutoCloseExpiredPlacement(flushPendingDraw(state, playerId, timestamp), timestamp)

  if (next.turn.phase === 'waiting_draw') {
    return fail('INVALID_PHASE', 'Finish drawing before rolling')
  }

  if (next.turn.phase === 'placement_phase') {
    return fail('PLACEMENT_NOT_CLOSED', 'Placement phase must end before rolling')
  }

  if (startedInLeaveStable && next.turn.phase === 'leave_stable_phase') {
    next = closeLeaveStablePhase(next, timestamp)
  }

  if (next.turn.phase === 'leave_stable_phase') {
    return next
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
  const before = state
  const prepared = prepareRollWithRunes(state, playerId)
  if ('success' in prepared && !prepared.success) return prepared
  const readyState = prepared as GameState

  if (readyState.turn.phase === 'leave_stable_phase') {
    return { success: true, state: readyState, events: sliceNewEvents(before, readyState) }
  }

  let next = rollTurn(readyState, rollFn)
  const diceResult = next.turn.diceResult ?? 0
  const autoSpawnMove =
    shouldAutoExitStable(next, diceResult, next.turn.legalMoves)
      ? pickAutoSpawnMove(next, next.turn.legalMoves)
      : null

  if (autoSpawnMove) {
    const beforeResolve = next
    next = resolveTurnWithRunesIfEnabled(next, autoSpawnMove.id)
    if (next === beforeResolve) {
      next = resolveTurn(beforeResolve)
    }
  } else if (next.turn.phase === 'waiting_choice' && next.turn.legalMoves.length === 1) {
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
  const chosenMove = moveId
    ? legalMoves.find((m) => m.id === moveId) ?? null
    : shouldAutoExitStable(state, diceResult, legalMoves)
      ? pickAutoSpawnMove(state, legalMoves)
      : legalMoves[0] ?? null

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

export { canSpawnFromLeaveStable }
