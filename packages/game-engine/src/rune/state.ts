import type { GameState, Player, RuneCardType, RuneGameState, RunePlayerState } from '@rune-race/shared'
import {
  RUNE_DRAW_HAND_THRESHOLD,
  RUNE_HELD_CARD_ROUNDS,
  RUNE_HONESTY_STREAK_FOR_REWARD,
  RUNE_MAX_DRAW_PER_PLAYER,
} from '@rune-race/shared'

export function createEmptyRunePlayerState(): RunePlayerState {
  return {
    drawCount: 0,
    hand: [],
    pendingDraw: null,
    hasClaimableHonestyReward: false,
    honestPlacementStreak: 0,
  }
}

export function createInitialRuneState(players: Player[]): RuneGameState {
  const record: Record<string, RunePlayerState> = {}
  players.forEach((p) => {
    record[p.id] = createEmptyRunePlayerState()
  })
  return {
    markers: [],
    players: record,
    placement: null,
  }
}

export function getRunePlayer(state: GameState, playerId: string): RunePlayerState | null {
  if (!state.rune) return null
  return state.rune.players[playerId] ?? null
}

export function handHasRoom(player: RunePlayerState): boolean {
  return player.hand.length < RUNE_DRAW_HAND_THRESHOLD
}

export function canDrawMore(player: RunePlayerState, count: number): boolean {
  if (player.pendingDraw) return false
  if (player.drawCount + count > RUNE_MAX_DRAW_PER_PLAYER) return false
  if (player.hand.length + count > RUNE_DRAW_HAND_THRESHOLD) return false
  return true
}

/**
 * Turn-start housekeeping: a completed honesty streak becomes a claimable
 * reward in this normal turn's draw & placement phase (spec §4.4).
 */
export function activateClaimableHonestyReward(
  state: GameState,
  playerId: string,
  timestamp: number,
): GameState {
  if (!state.rune) return state
  const player = state.rune.players[playerId]
  if (!player) return state
  if (player.hasClaimableHonestyReward) return state
  if (player.honestPlacementStreak < RUNE_HONESTY_STREAK_FOR_REWARD) return state

  return {
    ...state,
    events: [
      ...state.events,
      {
        type: 'honesty_reward_available',
        timestamp,
        playerId,
        details: { playerId },
      },
    ],
    rune: {
      ...state.rune,
      players: {
        ...state.rune.players,
        [playerId]: { ...player, hasClaimableHonestyReward: true },
      },
    },
  }
}

/**
 * Append the chosen honesty reward straight into the hand — even past the
 * draw threshold (spec §4.2/§4.4). Resets the streak; does not consume draw quota.
 */
export function grantHonestyReward(
  state: GameState,
  playerId: string,
  cardType: RuneCardType,
  timestamp: number,
  options: { autoSelected: boolean },
): GameState {
  if (!state.rune) return state
  const player = state.rune.players[playerId]
  if (!player?.hasClaimableHonestyReward) return state

  const heldCardId = `held-${state.roomId}-${playerId}-${timestamp}-v${state.version}-reward`
  const hand = [
    ...player.hand,
    {
      heldCardId,
      ownerPlayerId: playerId,
      cardType,
      remainingHandRounds: RUNE_HELD_CARD_ROUNDS,
      source: 'HONESTY_REWARD' as const,
    },
  ]

  return {
    ...state,
    events: [
      ...state.events,
      {
        type: 'honesty_reward_selected',
        timestamp,
        playerId,
        details: { playerId, cardType, autoSelected: options.autoSelected },
      },
      {
        type: 'honesty_reward_granted',
        timestamp,
        playerId,
        details: { playerId, cardType, heldCardId, autoSelected: options.autoSelected },
      },
    ],
    rune: {
      ...state.rune,
      players: {
        ...state.rune.players,
        [playerId]: {
          ...player,
          hand,
          hasClaimableHonestyReward: false,
          honestPlacementStreak: 0,
        },
      },
    },
  }
}
