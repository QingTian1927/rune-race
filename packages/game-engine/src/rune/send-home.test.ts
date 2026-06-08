import { describe, expect, it } from 'vitest'
import { createInitialGameState, boardSlotForPlayer, absoluteTrackIndexFor } from '../engine.js'
import { placeMarker } from './placement.js'
import { resolveMoveWithRunes } from './movement.js'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

function withSendHomeMarker(
  state: ReturnType<typeof createInitialGameState>,
  placerId: string,
  cellId: number,
) {
  const placement = {
    phaseId: 'test-placement',
    openedAt: Date.now(),
    minCloseAt: Date.now(),
    maxCloseAt: Date.now() + 60_000,
    honestyByPlayer: {},
  }
  const player = state.rune!.players[placerId]
  const heldCardId = `held-${placerId}-send-home`
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
              cardType: 'SEND_HOME' as const,
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

describe('SEND_HOME marker', () => {
  it('removes marker and sends activator home on exact stop', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    const blueStart = 3
    const trapCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), blueStart + 2)
    state = withSendHomeMarker(state, 'p-red', trapCell)

    expect(state.rune!.markers.some((m) => m.cellId === trapCell)).toBe(true)

    state = {
      ...state,
      tokens: state.tokens.map((t) =>
        t.id === blueToken.id ? { ...t, state: 'on_track' as const, position: blueStart } : t,
      ),
      turn: {
        ...state.turn,
        currentPlayerId: 'p-blue',
        phase: 'waiting_choice',
        diceResult: 2,
        legalMoves: [
          {
            id: 'move-blue',
            tokenId: blueToken.id,
            moveType: 'move',
            destination: blueStart + 2,
          },
        ],
      },
      phase: 'waiting_choice',
    }

    const afterMove = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    const blueAfter = afterMove.tokens.find((t) => t.id === blueToken.id)!

    expect(blueAfter.state).toBe('in_base')
    expect(afterMove.rune!.markers.some((m) => m.cellId === trapCell)).toBe(false)
    expect(
      afterMove.events.some(
        (e) => e.type === 'marker_triggered' && e.details?.cardType === 'SEND_HOME',
      ),
    ).toBe(true)
    expect(
      afterMove.events.some(
        (e) =>
          e.type === 'horse_status_changed' &&
          e.details?.status === 'sent_home' &&
          e.details?.tokenId === blueToken.id,
      ),
    ).toBe(true)
  })

  it('removes marker when shield blocks send home', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    const blueStart = 3
    const trapCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), blueStart + 2)
    state = withSendHomeMarker(state, 'p-red', trapCell)

    state = {
      ...state,
      tokens: state.tokens.map((t) =>
        t.id === blueToken.id
          ? { ...t, state: 'on_track' as const, position: blueStart, hasShield: true }
          : t,
      ),
      turn: {
        ...state.turn,
        currentPlayerId: 'p-blue',
        phase: 'waiting_choice',
        diceResult: 2,
        legalMoves: [
          {
            id: 'move-blue',
            tokenId: blueToken.id,
            moveType: 'move',
            destination: blueStart + 2,
          },
        ],
      },
      phase: 'waiting_choice',
    }

    const afterMove = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    const blueAfter = afterMove.tokens.find((t) => t.id === blueToken.id)!

    expect(blueAfter.state).toBe('on_track')
    expect(blueAfter.hasShield).toBe(false)
    expect(afterMove.rune!.markers.some((m) => m.cellId === trapCell)).toBe(false)
    expect(
      afterMove.events.some(
        (e) => e.type === 'marker_triggered' && e.details?.cardType === 'SEND_HOME',
      ),
    ).toBe(true)
  })
})
