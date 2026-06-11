import type { BotProfile, GameState, Token } from '@rune-race/shared'
import type { Rng } from '../types.js'

/** Legal swap targets: displayed identity's tokens on the main track, excluding the activator. */
export function listSwapCandidates(state: GameState): Token[] {
  const pending = state.turn.pendingSwap
  if (!pending) return []
  return state.tokens.filter(
    (t) =>
      t.playerId === pending.displayedIdentityId &&
      t.state === 'on_track' &&
      t.id !== pending.activatorTokenId,
  )
}

export function chooseSwapTarget(
  state: GameState,
  profile: BotProfile,
  rng: Rng = Math.random,
): Token | null {
  const candidates = listSwapCandidates(state)
  if (candidates.length === 0) return null

  if (profile === 'simple') {
    return candidates[Math.floor(rng() * candidates.length)] ?? candidates[0]!
  }

  // Complex: swap with the most progressed token — biggest positional gain.
  return candidates.reduce((best, token) => (token.position > best.position ? token : best))
}
