import { describe, expect, it } from 'vitest'
import { createInitialGameState, boardSlotForPlayer, absoluteTrackIndexFor } from '../engine.js'
import { placeMarker } from './placement.js'
import { resolveMoveWithRunes } from './movement.js'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

function findSharedCell(state: ReturnType<typeof createInitialGameState>) {
  for (let redPos = 4; redPos < 40; redPos += 1) {
    const abs = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-red'), redPos)
    for (let bluePos = 4; bluePos < 40; bluePos += 1) {
      if (absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), bluePos) === abs) {
        return { abs, redPos, bluePos }
      }
    }
  }
  return null
}

function withAdvanceMarker(
  state: ReturnType<typeof createInitialGameState>,
  placerId: string,
  cellId: number,
  stepValue: 2 | 3 | 4 = 2,
) {
  const cardType = `ADVANCE_${stepValue}` as const
  const placement = {
    phaseId: 'test-placement',
    openedAt: Date.now(),
    minCloseAt: Date.now(),
    maxCloseAt: Date.now() + 60_000,
    honestyByPlayer: {},
  }
  const player = state.rune!.players[placerId]
  const heldCardId = `held-${placerId}-advance`
  const withPhase = {
    ...state,
    turn: { ...state.turn, phase: 'placement_phase' as const, currentPlayerId: placerId },
    phase: 'placement_phase' as const,
    rune: {
      ...state.rune!,
      placement,
      players: {
        ...state.rune!.players,
        [placerId]: {
          ...player,
          hand: [
            ...player.hand,
            {
              heldCardId,
              ownerPlayerId: placerId,
              cardType,
              remainingHandRounds: 2,
              source: 'DRAW' as const,
            },
          ],
        },
      },
    },
  }
  const { state: placed } = placeMarker(
    withPhase,
    placerId,
    heldCardId,
    cellId,
    placerId,
    Date.now(),
  )
  return placed
}

describe('shared-track occupancy kick', () => {
  it('kicks friendly token when rune advance lands on same cell', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueTokens = state.tokens.filter((t) => t.playerId === 'p-blue')
    const [stationary, mover] = blueTokens
    const stationaryPos = 6
    const moverStart = 3
    const markerCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), moverStart + 1)

    state = withAdvanceMarker(state, 'p-red', markerCell, 2)

    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === stationary.id) {
          return { ...t, state: 'on_track' as const, position: stationaryPos }
        }
        if (t.id === mover.id) {
          return { ...t, state: 'on_track' as const, position: moverStart }
        }
        return t
      }),
      turn: {
        ...state.turn,
        currentPlayerId: 'p-blue',
        phase: 'waiting_choice',
        diceResult: 1,
        legalMoves: [
          {
            id: 'move-blue',
            tokenId: mover.id,
            moveType: 'move',
            destination: moverStart + 1,
          },
        ],
      },
      phase: 'waiting_choice',
    }

    const afterMove = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    const stationaryAfter = afterMove.tokens.find((t) => t.id === stationary.id)!
    const moverAfter = afterMove.tokens.find((t) => t.id === mover.id)!

    expect(stationaryAfter.state).toBe('in_base')
    expect(moverAfter.state).toBe('on_track')
    expect(moverAfter.position).toBe(stationaryPos)
    expect(
      afterMove.events.some(
        (e) =>
          e.type === 'token_captured' &&
          e.details?.capturedTokenId === stationary.id &&
          e.details?.tokenId === mover.id,
      ),
    ).toBe(true)
    const moveEvent = afterMove.events.find((e) => e.type === 'token_moved')
    expect(moveEvent?.details?.path?.some((step) => step.motion === 'teleport')).toBe(true)
  })

  it('kicks enemy token when rune advance lands on same cell', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const shared = findSharedCell(state)
    expect(shared).not.toBeNull()
    const { redPos, bluePos } = shared!
    const blueStart = bluePos - 3
    const markerCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), blueStart + 1)

    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    const redToken = state.tokens.find((t) => t.playerId === 'p-red')!

    state = withAdvanceMarker(state, 'p-red', markerCell, 2)

    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === redToken.id) return { ...t, state: 'on_track' as const, position: redPos }
        if (t.id === blueToken.id) return { ...t, state: 'on_track' as const, position: blueStart }
        return t
      }),
      turn: {
        ...state.turn,
        currentPlayerId: 'p-blue',
        phase: 'waiting_choice',
        diceResult: 1,
        legalMoves: [
          {
            id: 'move-blue',
            tokenId: blueToken.id,
            moveType: 'move',
            destination: blueStart + 1,
          },
        ],
      },
      phase: 'waiting_choice',
    }

    const afterMove = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    const redAfter = afterMove.tokens.find((t) => t.id === redToken.id)!

    expect(redAfter.state).toBe('in_base')
    expect(
      afterMove.events.some(
        (e) => e.type === 'token_captured' && e.details?.capturedTokenId === redToken.id,
      ),
    ).toBe(true)
  })
})
