import type { RuneCardType } from '@rune-race/shared'
import { RUNE_ADVANCE_BACK_TYPES, RUNE_OTHER_TYPES } from '@rune-race/shared'

export type Rng = () => number

const defaultRng: Rng = () => Math.random()

function pickUniform<T>(items: readonly T[], rng: Rng): T {
  const index = Math.floor(rng() * items.length)
  return items[Math.min(index, items.length - 1)]!
}

/** 60% advance/back pool, 40% other cards (uniform within each pool). */
export function drawRuneCardType(rng: Rng = defaultRng): RuneCardType {
  if (rng() < 0.6) {
    return pickUniform(RUNE_ADVANCE_BACK_TYPES, rng)
  }
  return pickUniform(RUNE_OTHER_TYPES, rng)
}
