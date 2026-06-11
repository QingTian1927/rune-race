import { describe, expect, it } from 'vitest'
import type { GameState, HeldCard, RuneCardType } from '@rune-race/shared'
import {
  RUNE_DRAW_HAND_THRESHOLD,
  RUNE_HONESTY_REWARD_TYPES,
  RUNE_HONESTY_STREAK_FOR_REWARD,
  RUNE_PLACEMENT_MIN_MS,
} from '@rune-race/shared'
import { createInitialGameState } from '../engine.js'
import { handleSelectHonestyReward } from '../rune-commands.js'
import { closePlacementPhase, maybeClosePlacementWhenAllReady } from './placement.js'
import { runTurnStartHousekeeping } from './turn-lifecycle.js'
import { activateClaimableHonestyReward, canDrawMore } from './state.js'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

function baseState(): GameState {
  return createInitialGameState({
    gameId: 'g1',
    players,
    firstPlayerId: 'p-red',
    runesEnabled: true,
  })
}

function withPlacementWindow(
  state: GameState,
  honestyByPlayer: Record<string, { placedCount: number; usedImpersonation: boolean }> = {},
): GameState {
  const openedAt = Date.now() - RUNE_PLACEMENT_MIN_MS - 1
  return {
    ...state,
    turn: { ...state.turn, phase: 'placement_phase' },
    phase: 'placement_phase',
    rune: {
      ...state.rune!,
      placement: {
        phaseId: 'test-placement',
        openedAt,
        minCloseAt: openedAt + RUNE_PLACEMENT_MIN_MS,
        maxCloseAt: openedAt + 30_000,
        honestyByPlayer,
        readyByPlayer: {},
      },
    },
  }
}

function withRunePlayer(
  state: GameState,
  playerId: string,
  patch: Partial<NonNullable<GameState['rune']>['players'][string]>,
): GameState {
  return {
    ...state,
    rune: {
      ...state.rune!,
      players: {
        ...state.rune!.players,
        [playerId]: { ...state.rune!.players[playerId]!, ...patch },
      },
    },
  }
}

function fillerHand(count: number): HeldCard[] {
  return Array.from({ length: count }, (_, i) => ({
    heldCardId: `held-filler-${i}`,
    ownerPlayerId: 'p-red',
    cardType: 'FREEZE' as RuneCardType,
    remainingHandRounds: 2,
    source: 'DRAW' as const,
  }))
}

describe('honesty streak completion (TC-24)', () => {
  it('caps the streak at 5 on honest placement and does not grant immediately', () => {
    let state = withPlacementWindow(baseState(), {
      'p-red': { placedCount: 1, usedImpersonation: false },
    })
    state = withRunePlayer(state, 'p-red', {
      honestPlacementStreak: RUNE_HONESTY_STREAK_FOR_REWARD - 1,
    })

    const after = closePlacementPhase(state, Date.now())
    const player = after.rune!.players['p-red']!

    expect(player.honestPlacementStreak).toBe(RUNE_HONESTY_STREAK_FOR_REWARD)
    expect(player.hand).toHaveLength(0)
    expect(player.hasClaimableHonestyReward).toBe(false)
    expect(after.events.some((e) => e.type === 'honesty_reward_granted')).toBe(false)
  })

  it('impersonation resets the streak to 0 (TC-25)', () => {
    let state = withPlacementWindow(baseState(), {
      'p-red': { placedCount: 1, usedImpersonation: true },
    })
    state = withRunePlayer(state, 'p-red', { honestPlacementStreak: 4 })

    const after = closePlacementPhase(state, Date.now())
    expect(after.rune!.players['p-red']!.honestPlacementStreak).toBe(0)
  })
})

describe('reward becomes claimable next normal turn', () => {
  it('turn-start housekeeping flags the reward and emits honesty_reward_available', () => {
    let state = baseState()
    state = withRunePlayer(state, 'p-red', {
      honestPlacementStreak: RUNE_HONESTY_STREAK_FOR_REWARD,
    })

    const after = runTurnStartHousekeeping(state, Date.now())
    expect(after.rune!.players['p-red']!.hasClaimableHonestyReward).toBe(true)
    expect(after.events.some((e) => e.type === 'honesty_reward_available')).toBe(true)
  })

  it('does not flag below the streak threshold', () => {
    let state = baseState()
    state = withRunePlayer(state, 'p-red', { honestPlacementStreak: 4 })
    const after = activateClaimableHonestyReward(state, 'p-red', Date.now())
    expect(after.rune!.players['p-red']!.hasClaimableHonestyReward).toBe(false)
  })

  it('does not flag during a bonus turn', () => {
    let state = baseState()
    state = { ...state, turn: { ...state.turn, isBonusTurn: true } }
    state = withRunePlayer(state, 'p-red', {
      honestPlacementStreak: RUNE_HONESTY_STREAK_FOR_REWARD,
    })
    const after = runTurnStartHousekeeping(state, Date.now())
    expect(after.rune!.players['p-red']!.hasClaimableHonestyReward).toBe(false)
  })
})

describe('selecting the reward (TC-27, TC-29)', () => {
  it('appends the chosen support card past the draw threshold and resets the streak', () => {
    let state = withPlacementWindow(baseState())
    state = withRunePlayer(state, 'p-red', {
      hand: fillerHand(RUNE_DRAW_HAND_THRESHOLD),
      hasClaimableHonestyReward: true,
      honestPlacementStreak: RUNE_HONESTY_STREAK_FOR_REWARD,
      drawCount: 10,
    })

    const result = handleSelectHonestyReward(state, 'p-red', 'SHIELD')
    expect(result.success).toBe(true)
    if (!result.success) return

    const player = result.state.rune!.players['p-red']!
    expect(player.hand).toHaveLength(RUNE_DRAW_HAND_THRESHOLD + 1)
    expect(player.hand.at(-1)!.cardType).toBe('SHIELD')
    expect(player.hand.at(-1)!.source).toBe('HONESTY_REWARD')
    expect(player.hasClaimableHonestyReward).toBe(false)
    expect(player.honestPlacementStreak).toBe(0)
    // Reward does not consume the 25-draw quota.
    expect(player.drawCount).toBe(10)
    // Normal draws stay blocked while at/over the threshold (TC-02 / TC-27).
    expect(canDrawMore(player, 1)).toBe(false)
    expect(
      result.events.some(
        (e) => e.type === 'honesty_reward_granted' && e.details?.autoSelected === false,
      ),
    ).toBe(true)
  })

  it('stacks multiple rewards past the threshold (TC-28)', () => {
    let state = withPlacementWindow(baseState())
    state = withRunePlayer(state, 'p-red', {
      hand: fillerHand(RUNE_DRAW_HAND_THRESHOLD + 1),
      hasClaimableHonestyReward: true,
    })

    const result = handleSelectHonestyReward(state, 'p-red', 'ADVANCE_4')
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.state.rune!.players['p-red']!.hand).toHaveLength(
      RUNE_DRAW_HAND_THRESHOLD + 2,
    )
  })

  it('rejects when no reward is claimable', () => {
    const state = withPlacementWindow(baseState())
    const result = handleSelectHonestyReward(state, 'p-red', 'SHIELD')
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.code).toBe('NO_CLAIMABLE_REWARD')
  })

  it('rejects non-support card types', () => {
    let state = withPlacementWindow(baseState())
    state = withRunePlayer(state, 'p-red', { hasClaimableHonestyReward: true })
    const result = handleSelectHonestyReward(state, 'p-red', 'SEND_HOME')
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.code).toBe('INVALID_REWARD_TYPE')
  })

  it('rejects players who are not the active player', () => {
    let state = withPlacementWindow(baseState())
    state = withRunePlayer(state, 'p-blue', { hasClaimableHonestyReward: true })
    const result = handleSelectHonestyReward(state, 'p-blue', 'SHIELD')
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.code).toBe('NOT_YOUR_TURN')
  })
})

describe('timeout auto-pick at placement close (TC-30, TC-32)', () => {
  it('grants a random support card when the window closes unclaimed', () => {
    let state = withPlacementWindow(baseState())
    state = withRunePlayer(state, 'p-red', {
      hasClaimableHonestyReward: true,
      honestPlacementStreak: RUNE_HONESTY_STREAK_FOR_REWARD,
    })

    const after = closePlacementPhase(state, Date.now())
    const player = after.rune!.players['p-red']!

    expect(player.hand).toHaveLength(1)
    expect(RUNE_HONESTY_REWARD_TYPES).toContain(player.hand[0]!.cardType)
    expect(player.hasClaimableHonestyReward).toBe(false)
    expect(player.honestPlacementStreak).toBe(0)
    expect(
      after.events.some(
        (e) => e.type === 'honesty_reward_granted' && e.details?.autoSelected === true,
      ),
    ).toBe(true)
  })

  it('honest placement in the claim turn starts the new streak at 1 (TC-32)', () => {
    let state = withPlacementWindow(baseState(), {
      'p-red': { placedCount: 1, usedImpersonation: false },
    })
    state = withRunePlayer(state, 'p-red', {
      hasClaimableHonestyReward: true,
      honestPlacementStreak: RUNE_HONESTY_STREAK_FOR_REWARD,
    })

    const after = closePlacementPhase(state, Date.now())
    const player = after.rune!.players['p-red']!

    expect(player.hand).toHaveLength(1)
    expect(player.honestPlacementStreak).toBe(1)
  })

  it('does not early-close placement while the active player still has an unclaimed reward', () => {
    const openedAt = Date.now() - RUNE_PLACEMENT_MIN_MS - 1
    let state = withPlacementWindow(baseState())
    state = {
      ...state,
      rune: {
        ...state.rune!,
        placement: {
          ...state.rune!.placement!,
          openedAt,
          minCloseAt: openedAt + RUNE_PLACEMENT_MIN_MS,
          maxCloseAt: openedAt + 30_000,
          readyByPlayer: { 'p-red': true, 'p-blue': true },
        },
      },
    }
    state = withRunePlayer(state, 'p-red', {
      hasClaimableHonestyReward: true,
      honestPlacementStreak: RUNE_HONESTY_STREAK_FOR_REWARD,
    })

    const afterEarly = maybeClosePlacementWhenAllReady(state, Date.now())
    expect(afterEarly.turn.phase).toBe('placement_phase')
    expect(afterEarly.rune!.players['p-red']!.hasClaimableHonestyReward).toBe(true)
    expect(afterEarly.events.some((e) => e.type === 'honesty_reward_granted')).toBe(false)

    const picked = handleSelectHonestyReward(afterEarly, 'p-red', 'SHIELD')
    expect(picked.success).toBe(true)
    if (!picked.success) return

    const afterConfirm = maybeClosePlacementWhenAllReady(picked.state, Date.now())
    expect(afterConfirm.turn.phase).toBe('waiting_roll')
    expect(afterConfirm.rune!.players['p-red']!.hasClaimableHonestyReward).toBe(false)
  })
})
