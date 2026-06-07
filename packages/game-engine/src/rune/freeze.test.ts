import { describe, expect, it } from 'vitest'
import { createInitialGameState, rollTurn } from '../engine.js'
import { placeMarker } from './placement.js'
import { resolveMoveWithRunes } from './movement.js'
import { absoluteTrackIndexFor, boardSlotForPlayer } from '../engine.js'
import { isTokenFrozen, beginNormalTurn, tickFreezeForPlayer } from './turn-lifecycle.js'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

function withFreezeInHand(state: ReturnType<typeof createInitialGameState>, playerId: string) {
  const player = state.rune!.players[playerId]
  const heldCardId = `held-test-${playerId}-freeze`
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
              cardType: 'FREEZE' as const,
              remainingHandRounds: 2,
              source: 'DRAW' as const,
            },
          ],
        },
      },
    },
  }
}

function withFreezeMarker(
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
  const withPhase = {
    ...state,
    turn: { ...state.turn, phase: 'placement_phase' as const, currentPlayerId: placerId },
    phase: 'placement_phase' as const,
    rune: { ...state.rune!, placement },
  }
  const ready = withFreezeInHand(withPhase, placerId)
  const heldCardId = ready.rune!.players[placerId].hand.find((c) => c.cardType === 'FREEZE')!.heldCardId
  const { state: placed } = placeMarker(
    ready,
    placerId,
    heldCardId,
    cellId,
    placerId,
    Date.now(),
  )
  return placed
}

function trackIndexForPlayer(state: ReturnType<typeof createInitialGameState>, playerId: string, progress: number) {
  const slot = boardSlotForPlayer(state, playerId)
  return absoluteTrackIndexFor(slot, progress)
}

describe('FREEZE rune', () => {
  it('applies freeze and blocks frozen token on next roll', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    const blueStart = 4
    const markerCell = trackIndexForPlayer(state, 'p-blue', blueStart + 2)
    state = withFreezeMarker(state, 'p-red', markerCell)

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
    const frozenToken = afterMove.tokens.find((t) => t.id === blueToken.id)!
    expect(isTokenFrozen(frozenToken)).toBe(true)
    expect(afterMove.rune!.markers.some((m) => m.cellId === markerCell)).toBe(false)
    expect(afterMove.events.some((e) => e.type === 'marker_triggered' && e.details?.cardType === 'FREEZE')).toBe(
      true,
    )

    const blueTurn = beginNormalTurn({
      ...afterMove,
      turn: { ...afterMove.turn, currentPlayerId: 'p-blue' },
      currentPlayerIndex: afterMove.players.findIndex((p) => p.id === 'p-blue'),
    })
    const rolled = rollTurn({
      ...blueTurn,
      turn: { ...blueTurn.turn, phase: 'waiting_roll' },
      phase: 'waiting_roll',
    }, () => 3)

    expect(rolled.turn.legalMoves.some((m) => m.tokenId === blueToken.id)).toBe(false)
  })

  it('emits freeze_expired when the last freeze turn ticks off', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    state = {
      ...state,
      tokens: state.tokens.map((t) =>
        t.id === blueToken.id
          ? { ...t, state: 'on_track' as const, position: 4, freezeTurnsRemaining: 1 }
          : t,
      ),
      turn: { ...state.turn, currentPlayerId: 'p-blue' },
      currentPlayerIndex: state.players.findIndex((p) => p.id === 'p-blue'),
    }

    const afterTick = tickFreezeForPlayer(state, 'p-blue', Date.now())
    const thawed = afterTick.tokens.find((t) => t.id === blueToken.id)!

    expect(isTokenFrozen(thawed)).toBe(false)
    expect(
      afterTick.events.some(
        (event) =>
          event.type === 'horse_status_changed' &&
          event.details?.status === 'freeze_expired' &&
          event.details?.tokenId === blueToken.id,
      ),
    ).toBe(true)
  })
})
