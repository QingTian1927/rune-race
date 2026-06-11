import type { BotProfile } from '@rune-race/shared'

const COMPLEX_CHANCE = 0.5

/** Random profile per bot — roughly half simple, half complex. */
export function pickBotProfile(rng: () => number = Math.random): BotProfile {
  return rng() < COMPLEX_CHANCE ? 'complex' : 'simple'
}
