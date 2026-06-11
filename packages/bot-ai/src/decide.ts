import type { GameEvent } from '@rune-race/shared'
import { chooseBotMove } from './core/choose-move.js'
import { chooseSwapTarget } from './core/choose-swap.js'
import { decideLeaveStableCard, decidePlacement, shouldDrawCard } from './rune/policies.js'
import type { BotAction, BotDecisionContext, Rng } from './types.js'

/**
 * Decide the bot's next action for the current state, or null when
 * there is nothing for this bot to do right now.
 */
export function decideNextAction(ctx: BotDecisionContext, rng: Rng = Math.random): BotAction | null {
  const { state, botPlayerId, profile } = ctx
  if (state.status !== 'playing') return null
  if (!state.players.some((p) => p.id === botPlayerId)) return null

  const isActive = state.turn.currentPlayerId === botPlayerId
  const phase = state.turn.phase

  if (phase === 'placement_phase' && state.rune) {
    if (state.rune.placement?.readyByPlayer?.[botPlayerId]) return null

    const runePlayer = state.rune.players[botPlayerId]
    if (isActive && runePlayer?.pendingDraw) {
      return { type: 'confirm_draw' }
    }
    if (isActive && shouldDrawCard(state, botPlayerId, profile, rng)) {
      return { type: 'draw_cards' }
    }

    const placement = decidePlacement(state, botPlayerId, profile, rng)
    if (placement) {
      return { type: 'place_marker', ...placement }
    }

    return { type: 'confirm_placement_ready' }
  }

  if (!isActive) return null

  if (phase === 'waiting_draw') {
    return { type: 'finish_draw' }
  }

  if (phase === 'leave_stable_phase') {
    const card = decideLeaveStableCard(state, botPlayerId, profile, rng)
    if (card) return { type: 'use_leave_stable', heldCardId: card.heldCardId }
    return { type: 'roll' }
  }

  if (phase === 'waiting_roll') {
    return { type: 'roll' }
  }

  if (phase === 'waiting_choice') {
    const move = chooseBotMove(state, botPlayerId, profile, rng)
    return move ? { type: 'choose_move', moveId: move.id } : null
  }

  if (phase === 'waiting_swap_choice') {
    const target = chooseSwapTarget(state, profile, rng)
    return target ? { type: 'choose_swap', targetTokenId: target.id } : null
  }

  return null
}

interface DelayRange {
  min: number
  max: number
}

const SIMPLE_DELAYS: Record<BotAction['type'], DelayRange> = {
  roll: { min: 800, max: 1800 },
  choose_move: { min: 600, max: 1400 },
  choose_swap: { min: 800, max: 1600 },
  draw_cards: { min: 700, max: 1400 },
  confirm_draw: { min: 600, max: 1200 },
  finish_draw: { min: 600, max: 1200 },
  place_marker: { min: 900, max: 2000 },
  confirm_placement_ready: { min: 1200, max: 2600 },
  use_leave_stable: { min: 800, max: 1600 },
}

const COMPLEX_DELAYS: Record<BotAction['type'], DelayRange> = {
  roll: { min: 1200, max: 2600 },
  choose_move: { min: 1400, max: 3000 },
  choose_swap: { min: 1400, max: 2800 },
  draw_cards: { min: 900, max: 1800 },
  confirm_draw: { min: 700, max: 1400 },
  finish_draw: { min: 700, max: 1400 },
  place_marker: { min: 1500, max: 3500 },
  confirm_placement_ready: { min: 1800, max: 3500 },
  use_leave_stable: { min: 1000, max: 2200 },
}

/** Human-like delay before executing an action. */
export function getActionDelayMs(
  profile: BotDecisionContext['profile'],
  actionType: BotAction['type'],
  rng: Rng = Math.random,
): number {
  const range = (profile === 'complex' ? COMPLEX_DELAYS : SIMPLE_DELAYS)[actionType]
  return Math.round(range.min + rng() * (range.max - range.min))
}

/** Matches the client dice-shake presentation so bots don't act mid-animation. */
export const DICE_PRESENTATION_MS = 3000
const MOVE_ANIMATION_MS = 1200

/** Extra wait after recent events so clients finish their animations first. */
export function getAnimationPaddingMs(events: GameEvent[]): number {
  let padding = 0
  for (const event of events) {
    if (event.type === 'dice_roll') {
      padding = Math.max(padding, DICE_PRESENTATION_MS)
    } else if (
      event.type === 'token_moved' ||
      event.type === 'token_captured' ||
      event.type === 'token_swapped' ||
      event.type === 'token_stepped'
    ) {
      padding = Math.max(padding, MOVE_ANIMATION_MS)
    }
  }
  return padding
}
