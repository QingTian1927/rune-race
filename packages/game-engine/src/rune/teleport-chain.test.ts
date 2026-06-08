import { describe, expect, it } from 'vitest'
import { createInitialGameState, boardSlotForPlayer, absoluteTrackIndexFor } from '../engine.js'
import { placeMarker } from './placement.js'
import { resolveMoveWithRunes } from './movement.js'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

function withRuneMarker(
  state: ReturnType<typeof createInitialGameState>,
  placerId: string,
  cellId: number,
  cardType: 'ADVANCE_2' | 'ADVANCE_4' | 'BACK_3',
  heldCardId: string,
) {
  const placement = {
    phaseId: 'test-placement',
    openedAt: Date.now(),
    minCloseAt: Date.now(),
    maxCloseAt: Date.now() + 60_000,
    honestyByPlayer: {},
  }
  const player = state.rune!.players[placerId]
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

describe('teleport chain path', () => {
  it('records separate teleport waypoints when BACK chains after ADVANCE lands', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const mover = state.tokens.find((t) => t.playerId === 'p-blue' && t.state === 'in_base')!
    const moverStart = 3
    const advanceCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), moverStart + 1)
    const backCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), moverStart + 3)

    state = withRuneMarker(state, 'p-red', advanceCell, 'ADVANCE_2', 'adv')
    state = withRuneMarker(state, 'p-red', backCell, 'BACK_3', 'back')

    state = {
      ...state,
      tokens: state.tokens.map((t) =>
        t.id === mover.id ? { ...t, state: 'on_track' as const, position: moverStart } : t,
      ),
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
    const path = afterMove.events.find((e) => e.type === 'token_moved')?.details?.path ?? []

    expect(path.filter((step) => step.motion === 'teleport')).toHaveLength(2)
    expect(path).toEqual([
      { state: 'on_track', position: 4, motion: 'step' },
      { state: 'on_track', position: 6, motion: 'teleport' },
      { state: 'on_track', position: 3, motion: 'teleport' },
    ])
  })

  it('splits mid-burst ADVANCE into its own teleport before BACK chains', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const mover = state.tokens.find((t) => t.playerId === 'p-blue' && t.state === 'in_base')!
    const moverStart = 3
    const advanceCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), moverStart + 1)
    const backCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), moverStart + 3)

    state = withRuneMarker(state, 'p-red', advanceCell, 'ADVANCE_4', 'adv')
    state = withRuneMarker(state, 'p-red', backCell, 'BACK_3', 'back')

    state = {
      ...state,
      tokens: state.tokens.map((t) =>
        t.id === mover.id ? { ...t, state: 'on_track' as const, position: moverStart } : t,
      ),
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
    const path = afterMove.events.find((e) => e.type === 'token_moved')?.details?.path ?? []

    expect(path.filter((step) => step.motion === 'teleport')).toHaveLength(2)
    expect(path.some((step) => step.motion === 'teleport' && step.position === 6)).toBe(true)
    expect(afterMove.tokens.find((t) => t.id === mover.id)?.position).toBe(3)
  })
})
