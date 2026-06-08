import { describe, expect, it } from 'vitest'
import type { GameState } from '@rune-race/shared'
import { createInitialGameState } from '../engine.js'
import { placeMarker } from './placement.js'
import { resolveMoveWithRunes, resolveSwapChoice } from './movement.js'
import { cellIdForTokenOnTrack } from './board-cells.js'
import { absoluteTrackIndexFor, boardSlotForPlayer, trackProgressForAbsoluteIndex } from '../engine.js'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

function withSwapInHand(state: GameState, playerId: string): GameState {
  const player = state.rune!.players[playerId]
  const heldCardId = `held-test-${playerId}-swap`
  return {
    ...state,
    rune: {
      ...state.rune!,
      players: {
        ...state.rune!.players,
        [playerId]: {
          ...player,
          hand: [
            ...player.hand,
            {
              heldCardId,
              ownerPlayerId: playerId,
              cardType: 'SWAP',
              remainingHandRounds: 2,
              source: 'DRAW',
            },
          ],
        },
      },
    },
  }
}

function withSwapMarker(
  state: GameState,
  placerId: string,
  cellId: number,
  displayedIdentityId: string,
) {
  const placement = {
    phaseId: 'test-placement',
    openedAt: Date.now(),
    minCloseAt: Date.now(),
    maxCloseAt: Date.now() + 60_000,
    honestyByPlayer: {},
  }
  const withPhase: GameState = {
    ...state,
    turn: { ...state.turn, phase: 'placement_phase', currentPlayerId: placerId },
    phase: 'placement_phase',
    rune: { ...state.rune!, placement },
  }
  const ready = withSwapInHand(withPhase, placerId)
  const heldCardId = ready.rune!.players[placerId].hand.find((c) => c.cardType === 'SWAP')!.heldCardId
  const { state: placed } = placeMarker(
    ready,
    placerId,
    heldCardId,
    cellId,
    displayedIdentityId,
    Date.now(),
  )
  return placed
}

function trackIndexForPlayer(state: GameState, playerId: string, progress: number) {
  const slot = boardSlotForPlayer(state, playerId)
  return absoluteTrackIndexFor(slot, progress)
}

function progressForPlayerAtAbsolute(state: GameState, playerId: string, absoluteIndex: number) {
  const slot = boardSlotForPlayer(state, playerId)
  return trackProgressForAbsoluteIndex(slot, absoluteIndex)
}

function findLandOnCell(state: GameState, playerId: string, targetCellId: number) {
  for (let steps = 1; steps <= 6; steps += 1) {
    for (let start = 0; start <= 43 - steps; start += 1) {
      const end = start + steps
      if (trackIndexForPlayer(state, playerId, end) === targetCellId) {
        return { start, steps }
      }
    }
  }
  return null
}

describe('SWAP rune', () => {
  it('enters waiting_swap_choice when activator owner differs from displayed identity', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    const redTokens = state.tokens.filter((t) => t.playerId === 'p-red')
    const blueStart = 5
    const markerCell = trackIndexForPlayer(state, 'p-blue', blueStart + 3)
    const land = findLandOnCell(state, 'p-blue', markerCell)
    expect(land).not.toBeNull()
    state = withSwapMarker(state, 'p-red', markerCell, 'p-red')

    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === blueToken.id) return { ...t, state: 'on_track' as const, position: land!.start }
        if (t.id === redTokens[0]?.id) return { ...t, state: 'on_track' as const, position: 20 }
        if (t.id === redTokens[1]?.id) return { ...t, state: 'on_track' as const, position: 28 }
        return t
      }),
      turn: {
        ...state.turn,
        currentPlayerId: 'p-blue',
        phase: 'waiting_choice',
        diceResult: land!.steps,
        legalMoves: [
          {
            id: 'move-blue',
            tokenId: blueToken.id,
            moveType: 'move',
            destination: land!.start + land!.steps,
          },
        ],
      },
      phase: 'waiting_choice',
    }

    const move = state.turn.legalMoves[0]!
    const afterMove = resolveMoveWithRunes(state, move)

    expect(afterMove.turn.phase).toBe('waiting_swap_choice')
    expect(afterMove.turn.pendingSwap?.displayedIdentityId).toBe('p-red')
    expect(afterMove.rune!.markers.some((m) => m.cellId === markerCell)).toBe(false)
    expect(
      afterMove.events.some(
        (event) => event.type === 'token_moved' && event.details?.tokenId === blueToken.id,
      ),
    ).toBe(true)

    const landedCell = cellIdForTokenOnTrack(afterMove, afterMove.tokens.find((t) => t.id === blueToken.id)!)
    expect(landedCell).toBe(markerCell)
  })

  it('does not swap when displayed identity matches activator owner (TC-16)', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    const blueStart = 5
    const markerCell = trackIndexForPlayer(state, 'p-blue', blueStart + 2)
    const land = findLandOnCell(state, 'p-blue', markerCell)
    expect(land).not.toBeNull()
    state = withSwapMarker(state, 'p-red', markerCell, 'p-blue')

    state = {
      ...state,
      tokens: state.tokens.map((t) =>
        t.id === blueToken.id ? { ...t, state: 'on_track' as const, position: land!.start } : t,
      ),
      turn: {
        ...state.turn,
        currentPlayerId: 'p-blue',
        phase: 'waiting_choice',
        diceResult: land!.steps,
        legalMoves: [
          {
            id: 'move-blue',
            tokenId: blueToken.id,
            moveType: 'move',
            destination: land!.start + land!.steps,
          },
        ],
      },
      phase: 'waiting_choice',
    }

    const afterMove = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    expect(afterMove.turn.phase).not.toBe('waiting_swap_choice')
    expect(afterMove.rune!.markers.some((m) => m.cellId === markerCell)).toBe(false)
  })

  it('resolves manual swap choice by exchanging positions', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    const redTokens = state.tokens.filter((t) => t.playerId === 'p-red')
    const blueStart = 5
    const markerCell = trackIndexForPlayer(state, 'p-blue', blueStart + 3)
    const land = findLandOnCell(state, 'p-blue', markerCell)
    expect(land).not.toBeNull()
    state = withSwapMarker(state, 'p-red', markerCell, 'p-red')

    const redProgress = 25
    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === blueToken.id) return { ...t, state: 'on_track' as const, position: land!.start }
        if (t.id === redTokens[0]?.id) return { ...t, state: 'on_track' as const, position: redProgress }
        if (t.id === redTokens[1]?.id) return { ...t, state: 'on_track' as const, position: 30 }
        return t
      }),
      turn: {
        ...state.turn,
        currentPlayerId: 'p-blue',
        phase: 'waiting_choice',
        diceResult: land!.steps,
        legalMoves: [
          {
            id: 'move-blue',
            tokenId: blueToken.id,
            moveType: 'move',
            destination: land!.start + land!.steps,
          },
        ],
      },
      phase: 'waiting_choice',
    }

    let afterMove = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    expect(afterMove.turn.phase).toBe('waiting_swap_choice')
    afterMove = resolveSwapChoice(afterMove, 'p-blue', redTokens[0]!.id)

    const blueAfter = afterMove.tokens.find((t) => t.id === blueToken.id)!
    const redAfter = afterMove.tokens.find((t) => t.id === redTokens[0]!.id)!
    expect(afterMove.events.some((e) => e.type === 'token_swapped')).toBe(true)
    const blueLandProgress = land!.start + land!.steps
    const blueAbs = trackIndexForPlayer(state, 'p-blue', blueLandProgress)
    const redAbs = trackIndexForPlayer(state, 'p-red', redProgress)
    expect(blueAfter.position).toBe(progressForPlayerAtAbsolute(state, 'p-blue', redAbs))
    expect(redAfter.position).toBe(progressForPlayerAtAbsolute(state, 'p-red', blueAbs))
    expect(trackIndexForPlayer(afterMove, 'p-blue', blueAfter.position)).toBe(redAbs)
    expect(trackIndexForPlayer(afterMove, 'p-red', redAfter.position)).toBe(blueAbs)
  })

  it('auto-swaps when displayed identity has exactly one valid token', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    const redToken = state.tokens.find((t) => t.playerId === 'p-red')!
    const blueStart = 5
    const markerCell = trackIndexForPlayer(state, 'p-blue', blueStart + 3)
    const land = findLandOnCell(state, 'p-blue', markerCell)
    expect(land).not.toBeNull()
    state = withSwapMarker(state, 'p-red', markerCell, 'p-red')

    const redProgress = 25
    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === blueToken.id) return { ...t, state: 'on_track' as const, position: land!.start }
        if (t.id === redToken.id) return { ...t, state: 'on_track' as const, position: redProgress }
        return t
      }),
      turn: {
        ...state.turn,
        currentPlayerId: 'p-blue',
        phase: 'waiting_choice',
        diceResult: land!.steps,
        legalMoves: [
          {
            id: 'move-blue',
            tokenId: blueToken.id,
            moveType: 'move',
            destination: land!.start + land!.steps,
          },
        ],
      },
      phase: 'waiting_choice',
    }

    const afterMove = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    expect(afterMove.turn.phase).not.toBe('waiting_swap_choice')
    expect(afterMove.events.some((e) => e.type === 'token_swapped')).toBe(true)
    const swapEvent = afterMove.events.find((e) => e.type === 'token_swapped')
    expect(swapEvent?.details?.automatic).toBe(true)
  })
})
