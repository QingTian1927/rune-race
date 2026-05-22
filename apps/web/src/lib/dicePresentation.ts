import type { GameEvent, GameState } from '@rune-race/shared'

/** DiceShaker phase lengths (seconds). */
export const DICE_PHASE_DURATIONS = {
  appearing: 0.22,
  shaking: 1.1,
  lifting: 0.42,
  revealing: 0.22,
} as const

/** Bucket visible after reveal before fade-out. */
export const BUCKET_HOLD_AFTER_REVEAL_SECONDS = 1

export const BUCKET_FADE_OUT_SECONDS = 0.25

/** Total time until dice presentation is done (ms). */
export const DICE_ANIMATION_TOTAL_MS = Math.ceil(
  (DICE_PHASE_DURATIONS.appearing +
    DICE_PHASE_DURATIONS.shaking +
    DICE_PHASE_DURATIONS.lifting +
    DICE_PHASE_DURATIONS.revealing +
    BUCKET_HOLD_AFTER_REVEAL_SECONDS) *
    1000,
)

/** @deprecated Use DICE_ANIMATION_TOTAL_MS */
export const DICE_PRESENTATION_MS = DICE_ANIMATION_TOTAL_MS

export function extractDiceResultFromEvents(events: GameEvent[]): number | null {
  const rollEvent = [...events].reverse().find((e) => e.type === 'dice_roll')
  if (!rollEvent) return null
  const value = Number(rollEvent.details?.result ?? NaN)
  if (!Number.isFinite(value) || value < 1 || value > 6) return null
  return value
}

export function hasDiceRollInDelta(events: GameEvent[]): boolean {
  return events.some((e) => e.type === 'dice_roll')
}

/**
 * While dice animates: freeze tokens, hide legal moves / dice on turn UI.
 * Events still update so DiceShaker can read the roll.
 */
export function createGatedDisplayState(prev: GameState, incoming: GameState): GameState {
  return {
    ...incoming,
    tokens: prev.tokens,
    phase: 'waiting_roll',
    turn: {
      ...incoming.turn,
      diceResult: null,
      legalMoves: [],
      phase: 'waiting_roll',
    },
  }
}
