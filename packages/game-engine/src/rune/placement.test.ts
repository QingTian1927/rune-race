import { describe, expect, it } from 'vitest'
import { RUNE_PLACEMENT_MIN_MS } from '@rune-race/shared'
import { createInitialGameState } from '../engine.js'
import { handleConfirmPlacementReady, prepareRollWithRunes } from '../rune-commands.js'
import { handleRoll } from '../commands.js'
import {
  closePlacementPhase,
  confirmPlacementReady,
  openPlacementPhase,
  placeMarker,
  tickPlacementPhase,
} from './placement.js'
import { listValidPlacementCellIds } from './board-cells.js'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

function withPlacementWindow(state: ReturnType<typeof createInitialGameState>) {
  const openedAt = Date.now() - RUNE_PLACEMENT_MIN_MS - 1
  return {
    ...state,
    turn: { ...state.turn, phase: 'placement_phase' as const },
    phase: 'placement_phase' as const,
    rune: {
      ...state.rune!,
      placement: {
        phaseId: 'test-placement',
        openedAt,
        minCloseAt: openedAt + RUNE_PLACEMENT_MIN_MS,
        maxCloseAt: openedAt + 30_000,
        honestyByPlayer: {},
        readyByPlayer: {},
      },
    },
  }
}

describe('placement phase closure', () => {
  it('rejects roll while placement is still open', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })
    state = withPlacementWindow(state)

    const prepared = prepareRollWithRunes(state, 'p-red')
    expect('success' in prepared && prepared.success === false).toBe(true)
    if (!('success' in prepared) || prepared.success) return
    expect(prepared.error.code).toBe('PLACEMENT_NOT_CLOSED')
  })

  it('closes early when every player confirms after min window', () => {
    let state = withPlacementWindow(
      createInitialGameState({
        gameId: 'g1',
        players,
        firstPlayerId: 'p-red',
        runesEnabled: true,
      }),
    )

    state = confirmPlacementReady(state, 'p-red', Date.now())
    expect(state.turn.phase).toBe('placement_phase')

    state = confirmPlacementReady(state, 'p-blue', Date.now())
    expect(state.turn.phase).toBe('waiting_roll')
    expect(state.rune?.placement).toBeNull()
  })

  it('auto-closes at max timer via tickPlacementPhase', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })
    const openedAt = Date.now() - 31_000
    state = {
      ...state,
      turn: { ...state.turn, phase: 'placement_phase' },
      phase: 'placement_phase',
      rune: {
        ...state.rune!,
        placement: {
          phaseId: 'expired',
          openedAt,
          minCloseAt: openedAt + RUNE_PLACEMENT_MIN_MS,
          maxCloseAt: openedAt + 30_000,
          honestyByPlayer: {},
          readyByPlayer: {},
        },
      },
    }

    const after = tickPlacementPhase(state, Date.now())
    expect(after.turn.phase).toBe('waiting_roll')
  })

  it('rejects marker placement after the player confirmed placement ready', () => {
    let state = withPlacementWindow(
      createInitialGameState({
        gameId: 'g1',
        players,
        firstPlayerId: 'p-red',
        runesEnabled: true,
      }),
    )

    const player = state.rune!.players['p-red']
    const heldCardId = 'held-test-p-red-freeze'
    state = {
      ...state,
      rune: {
        ...state.rune!,
        players: {
          ...state.rune!.players,
          'p-red': {
            ...player,
            hand: [
              ...player.hand,
              {
                heldCardId,
                ownerPlayerId: 'p-red',
                cardType: 'FREEZE',
                remainingHandRounds: 2,
                source: 'DRAW',
              },
            ],
          },
        },
      },
    }

    const cellId = listValidPlacementCellIds(state)[0]
    expect(cellId).toBeDefined()

    state = confirmPlacementReady(state, 'p-red', Date.now())
    expect(state.rune!.placement?.readyByPlayer['p-red']).toBe(true)

    const { state: after, events } = placeMarker(
      state,
      'p-red',
      heldCardId,
      cellId!,
      'p-red',
      Date.now(),
    )

    expect(after).toBe(state)
    expect(events.some((event) => event.details?.reason === 'placement_confirmed')).toBe(true)
  })

  it('handleConfirmPlacementReady is idempotent for the same player', () => {
    const state = withPlacementWindow(
      createInitialGameState({
        gameId: 'g1',
        players,
        firstPlayerId: 'p-red',
        runesEnabled: true,
      }),
    )

    const first = handleConfirmPlacementReady(state, 'p-red')
    const second = handleConfirmPlacementReady(first.success ? first.state : state, 'p-red')
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
  })

  it('allows roll only after placement closes', () => {
    let state = withPlacementWindow(
      createInitialGameState({
        gameId: 'g1',
        players,
        firstPlayerId: 'p-red',
        runesEnabled: true,
      }),
    )
    state = closePlacementPhase(state, Date.now())
    expect(state.turn.phase).toBe('waiting_roll')
    expect(state.rune?.placement).toBeNull()

    const duringPlacement = handleRoll(
      withPlacementWindow(
        createInitialGameState({
          gameId: 'g1',
          players,
          firstPlayerId: 'p-red',
          runesEnabled: true,
        }),
      ),
      'p-red',
      () => 2,
    )
    expect(duringPlacement.success).toBe(false)
    if (duringPlacement.success) return
    expect(duringPlacement.error.code).toBe('PLACEMENT_NOT_CLOSED')

    const rolled = handleRoll(state, 'p-red', () => 2)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return
    expect(rolled.events.some((event) => event.type === 'dice_roll')).toBe(true)
  })
})
