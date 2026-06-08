import { describe, expect, it } from 'vitest'
import { boardSlotForPlayer, absoluteTrackIndexFor, createInitialGameState } from '../engine.js'
import { closePlacementPhase, placeMarker } from './placement.js'
import { canSpawnFromLeaveStable, handleUseLeaveStable } from '../rune-commands.js'
import { handleRoll } from '../commands.js'
import { RUNE_PLACEMENT_MIN_MS } from '@rune-race/shared'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

function leaveStableCard(playerId: string, heldCardId = `ls-${playerId}`) {
  return {
    heldCardId,
    ownerPlayerId: playerId,
    cardType: 'LEAVE_STABLE' as const,
    remainingHandRounds: 2,
    source: 'DRAW' as const,
  }
}

function withLeaveStablePhase(
  state: ReturnType<typeof createInitialGameState>,
  playerId: string,
  cardCount = 1,
) {
  const player = state.rune!.players[playerId]
  const cards = Array.from({ length: cardCount }, (_, index) =>
    leaveStableCard(playerId, `ls-${playerId}-${index}`),
  )
  return {
    ...state,
    turn: { ...state.turn, phase: 'leave_stable_phase' as const, currentPlayerId: playerId },
    phase: 'leave_stable_phase' as const,
    rune: {
      ...state.rune!,
      placement: null,
      players: {
        ...state.rune!.players,
        [playerId]: { ...player, hand: cards },
      },
    },
  }
}

describe('LEAVE_STABLE direct use', () => {
  it('includes full teleport path when spawn triggers ADVANCE on start cell', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })
    const startCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-red'), 0)
    const placement = {
      phaseId: 'test-placement',
      openedAt: Date.now(),
      minCloseAt: Date.now(),
      maxCloseAt: Date.now() + 60_000,
      honestyByPlayer: {},
    }
    const placer = state.rune!.players['p-blue']
    state = {
      ...state,
      turn: { ...state.turn, phase: 'placement_phase' as const, currentPlayerId: 'p-blue' },
      phase: 'placement_phase' as const,
      rune: {
        ...state.rune!,
        placement,
        players: {
          ...state.rune!.players,
          'p-blue': {
            ...placer,
            hand: [
              ...placer.hand,
              {
                heldCardId: 'adv-start',
                ownerPlayerId: 'p-blue',
                cardType: 'ADVANCE_2' as const,
                remainingHandRounds: 2,
                source: 'DRAW' as const,
              },
            ],
          },
        },
      },
    }
    const { state: withMarker } = placeMarker(
      state,
      'p-blue',
      'adv-start',
      startCell,
      'p-blue',
      Date.now(),
    )
    state = withLeaveStablePhase(withMarker, 'p-red')
    const heldCardId = state.rune!.players['p-red'].hand[0]!.heldCardId

    const result = handleUseLeaveStable(state, 'p-red', heldCardId)
    expect(result.success).toBe(true)
    if (!result.success) return

    const moveEvent = result.events.find((e) => e.type === 'token_moved')
    const path = moveEvent?.details?.path ?? []
    expect(path.some((step) => step.motion === 'teleport')).toBe(true)
    expect(moveEvent?.details?.to).toEqual({ state: 'on_track', position: 2 })
  })

  it('TC-14: spawns a token from base when start cell is empty', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })
    state = withLeaveStablePhase(state, 'p-red')
    const inBaseBefore = state.tokens.filter((t) => t.playerId === 'p-red' && t.state === 'in_base').length
    const heldCardId = state.rune!.players['p-red'].hand[0]!.heldCardId

    const result = handleUseLeaveStable(state, 'p-red', heldCardId)
    expect(result.success).toBe(true)
    if (!result.success) return

    const inBaseAfter = result.state.tokens.filter((t) => t.playerId === 'p-red' && t.state === 'in_base').length
    const onStart = result.state.tokens.some(
      (t) => t.playerId === 'p-red' && t.state === 'on_track' && t.position === 0,
    )
    expect(inBaseAfter).toBe(inBaseBefore - 1)
    expect(onStart).toBe(true)
    expect(result.state.rune!.players['p-red'].hand).toHaveLength(0)
    expect(result.events.some((e) => e.type === 'leave_stable_used')).toBe(true)
    expect(result.events.some((e) => e.type === 'token_moved')).toBe(true)
  })

  it('TC-15: consumes card without spawning when own token already at start', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })
    const redToken = state.tokens.find((t) => t.playerId === 'p-red')!
    state = {
      ...withLeaveStablePhase(state, 'p-red'),
      tokens: state.tokens.map((t) =>
        t.id === redToken.id ? { ...t, state: 'on_track' as const, position: 0 } : t,
      ),
    }
    const heldCardId = state.rune!.players['p-red'].hand[0]!.heldCardId
    const inBaseBefore = state.tokens.filter((t) => t.playerId === 'p-red' && t.state === 'in_base').length

    const result = handleUseLeaveStable(state, 'p-red', heldCardId)
    expect(result.success).toBe(true)
    if (!result.success) return

    const inBaseAfter = result.state.tokens.filter((t) => t.playerId === 'p-red' && t.state === 'in_base').length
    expect(inBaseAfter).toBe(inBaseBefore)
    expect(result.state.rune!.players['p-red'].hand).toHaveLength(0)
  })

  it('TC-17: consumes card when base is empty', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })
    state = {
      ...withLeaveStablePhase(state, 'p-red'),
      tokens: state.tokens.map((t) =>
        t.playerId === 'p-red' ? { ...t, state: 'on_track' as const, position: 2 } : t,
      ),
    }
    const heldCardId = state.rune!.players['p-red'].hand[0]!.heldCardId

    const result = handleUseLeaveStable(state, 'p-red', heldCardId)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.state.rune!.players['p-red'].hand).toHaveLength(0)
  })

  it('TC-19: second use does not spawn when start is occupied by own token', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })
    state = withLeaveStablePhase(state, 'p-red', 2)
    const heldFirst = state.rune!.players['p-red'].hand[0]!.heldCardId
    const heldSecond = state.rune!.players['p-red'].hand[1]!.heldCardId

    const first = handleUseLeaveStable(state, 'p-red', heldFirst)
    expect(first.success).toBe(true)
    if (!first.success) return

    const onStartAfterFirst = first.state.tokens.filter(
      (t) => t.playerId === 'p-red' && t.state === 'on_track' && t.position === 0,
    )
    expect(onStartAfterFirst).toHaveLength(1)

    const second = handleUseLeaveStable(first.state, 'p-red', heldSecond)
    expect(second.success).toBe(true)
    if (!second.success) return

    const onStartAfterSecond = second.state.tokens.filter(
      (t) => t.playerId === 'p-red' && t.state === 'on_track' && t.position === 0,
    )
    expect(onStartAfterSecond).toHaveLength(1)
    expect(second.state.rune!.players['p-red'].hand).toHaveLength(0)
  })

  it('opens leave_stable_phase only when active player holds LEAVE_STABLE', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })
    const redPlayer = state.rune!.players['p-red']
    state = {
      ...state,
      rune: {
        ...state.rune!,
        players: {
          ...state.rune!.players,
          'p-red': {
            ...redPlayer,
            hand: [...redPlayer.hand, leaveStableCard('p-red')],
          },
        },
      },
    }

    const closed = closePlacementPhase(state, Date.now())
    expect(closed.turn.phase).toBe('leave_stable_phase')
  })

  it('skips leave_stable_phase when active player has no LEAVE_STABLE', () => {
    const state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })

    const closed = closePlacementPhase(state, Date.now())
    expect(closed.turn.phase).toBe('waiting_roll')
  })

  it('rejects leave stable while placement is still open', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })
    const redPlayer = state.rune!.players['p-red']
    const heldCardId = leaveStableCard('p-red').heldCardId
    state = {
      ...state,
      rune: {
        ...state.rune!,
        players: {
          ...state.rune!.players,
          'p-red': {
            ...redPlayer,
            hand: [...redPlayer.hand, leaveStableCard('p-red')],
          },
        },
      },
    }

    const result = handleUseLeaveStable(state, 'p-red', heldCardId)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.code).toBe('INVALID_PHASE')
  })

  it('roll after placement closes opens leave_stable_phase without consuming the card', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })
    const redPlayer = state.rune!.players['p-red']
    state = closePlacementPhase(
      {
        ...state,
        rune: {
          ...state.rune!,
          players: {
            ...state.rune!.players,
            'p-red': {
              ...redPlayer,
              hand: [...redPlayer.hand, leaveStableCard('p-red')],
            },
          },
        },
      },
      Date.now(),
    )

    expect(state.turn.phase).toBe('leave_stable_phase')

    const rolled = handleRoll(state, 'p-red', () => 3)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return
    expect(rolled.state.turn.phase).not.toBe('leave_stable_phase')
    expect(rolled.events.some((event) => event.type === 'dice_roll')).toBe(true)
    expect(rolled.state.rune!.players['p-red'].hand.some((c) => c.cardType === 'LEAVE_STABLE')).toBe(true)
  })

  it('roll closes leave_stable_phase without using the card', () => {
    let state = withLeaveStablePhase(
      createInitialGameState({
        gameId: 'g1',
        players,
        firstPlayerId: 'p-red',
        runesEnabled: true,
      }),
      'p-red',
    )

    const rolled = handleRoll(state, 'p-red', () => 3)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return
    expect(rolled.state.turn.phase).not.toBe('leave_stable_phase')
    expect(rolled.state.rune!.players['p-red'].hand).toHaveLength(1)
  })
})

describe('canSpawnFromLeaveStable', () => {
  it('returns false when all tokens left base', () => {
    let state = withLeaveStablePhase(
      createInitialGameState({
        gameId: 'g1',
        players,
        firstPlayerId: 'p-red',
        runesEnabled: true,
      }),
      'p-red',
    )
    state = {
      ...state,
      tokens: state.tokens.map((token) =>
        token.playerId === 'p-red' ? { ...token, state: 'on_track' as const, position: 5 } : token,
      ),
    }
    expect(canSpawnFromLeaveStable(state, 'p-red')).toBe(false)
  })

  it('returns false when own horse already occupies start cell', () => {
    let state = withLeaveStablePhase(
      createInitialGameState({
        gameId: 'g1',
        players,
        firstPlayerId: 'p-red',
        runesEnabled: true,
      }),
      'p-red',
    )
    const onStart = state.tokens.find((t) => t.playerId === 'p-red' && t.state === 'in_base')!
    state = {
      ...state,
      tokens: state.tokens.map((token) =>
        token.id === onStart.id
          ? { ...token, state: 'on_track' as const, position: 0 }
          : token,
      ),
    }
    expect(canSpawnFromLeaveStable(state, 'p-red')).toBe(false)
  })

  it('returns true when a token remains in base and start is clear', () => {
    const state = withLeaveStablePhase(
      createInitialGameState({
        gameId: 'g1',
        players,
        firstPlayerId: 'p-red',
        runesEnabled: true,
      }),
      'p-red',
    )
    expect(canSpawnFromLeaveStable(state, 'p-red')).toBe(true)
  })
})
