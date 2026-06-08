import { describe, expect, it } from 'vitest'
import { createInitialGameState, boardSlotForPlayer, absoluteTrackIndexFor } from '../engine.js'
import { placeMarker } from './placement.js'
import { resolveMoveWithRunes } from './movement.js'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

function withBackMarker(
  state: ReturnType<typeof createInitialGameState>,
  placerId: string,
  cellId: number,
  steps: 3 | 4 | 5 = 4,
) {
  const cardType = `BACK_${steps}` as const
  const placement = {
    phaseId: 'test-placement',
    openedAt: Date.now(),
    minCloseAt: Date.now(),
    maxCloseAt: Date.now() + 60_000,
    honestyByPlayer: {},
  }
  const player = state.rune!.players[placerId]
  const heldCardId = `held-${placerId}-back`
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

describe('BACK marker occupancy kick', () => {
  it('does not kick friendly token when BACK_4 only passes through their cell', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueTokens = state.tokens.filter((t) => t.playerId === 'p-blue')
    const [stationary, mover] = blueTokens
    const passThroughPos = 7
    const moverStart = 9
    const markerCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), 10)

    state = withBackMarker(state, 'p-red', markerCell, 4)

    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === stationary.id) {
          return { ...t, state: 'on_track' as const, position: passThroughPos }
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
    const moveEvent = afterMove.events.find((e) => e.type === 'token_moved')

    expect(stationaryAfter.state).toBe('on_track')
    expect(stationaryAfter.position).toBe(passThroughPos)
    expect(moverAfter.state).toBe('on_track')
    expect(moverAfter.position).toBe(6)
    expect(
      afterMove.events.some(
        (e) =>
          e.type === 'token_captured' &&
          e.details?.capturedTokenId === stationary.id,
      ),
    ).toBe(false)
    expect(moveEvent?.details?.path?.some((step) => step.motion === 'teleport')).toBe(true)
  })

  it('kicks friendly token when BACK_4 ends on same cell', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueTokens = state.tokens.filter((t) => t.playerId === 'p-blue')
    const [stationary, mover] = blueTokens
    const stationaryPos = 6
    const moverStart = 9
    const markerCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), 10)

    state = withBackMarker(state, 'p-red', markerCell, 4)

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
      afterMove.tokens.filter(
        (t) =>
          t.playerId === 'p-blue' &&
          t.state === 'on_track' &&
          t.position === stationaryPos,
      ),
    ).toHaveLength(1)
  })
})
