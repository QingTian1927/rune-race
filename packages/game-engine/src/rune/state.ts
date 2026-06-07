import type { GameState, Player, RuneGameState, RunePlayerState } from '@rune-race/shared'
import { RUNE_MAX_DRAW_PER_PLAYER, RUNE_MAX_HAND_SIZE } from '@rune-race/shared'

export function createEmptyRunePlayerState(): RunePlayerState {
  return {
    drawCount: 0,
    hand: [],
    pendingDraw: null,
    pendingRewards: [],
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
  return player.hand.length < RUNE_MAX_HAND_SIZE
}

export function canDrawMore(player: RunePlayerState, count: number): boolean {
  if (player.pendingDraw) return false
  if (player.drawCount + count > RUNE_MAX_DRAW_PER_PLAYER) return false
  if (player.hand.length + count > RUNE_MAX_HAND_SIZE) return false
  return true
}

export function drainPendingRewards(state: GameState, playerId: string, timestamp: number) {
  if (!state.rune) return state
  const player = state.rune.players[playerId]
  if (!player || player.pendingRewards.length === 0) return state

  const events = [...state.events]
  let hand = [...player.hand]
  const pending = [...player.pendingRewards]

  while (pending.length > 0 && hand.length < RUNE_MAX_HAND_SIZE) {
    const cardType = pending.shift()!
    const heldCardId = `held-${state.roomId}-${playerId}-${state.version}-${hand.length}`
    hand.push({
      heldCardId,
      ownerPlayerId: playerId,
      cardType,
      remainingHandRounds: 2,
      source: 'HONESTY_REWARD',
    })
    events.push({
      type: 'honesty_reward_granted',
      timestamp,
      playerId,
      details: { playerId, cardType, heldCardId },
    })
  }

  return {
    ...state,
    events,
    rune: {
      ...state.rune,
      players: {
        ...state.rune.players,
        [playerId]: { ...player, hand, pendingRewards: pending },
      },
    },
  }
}
