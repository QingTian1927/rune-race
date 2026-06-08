import type { GameEvent, GameState } from '@rune-race/shared'

function getFinishOrderFromEvents(events: GameEvent[]): string[] {
  const order: string[] = []
  events.forEach((event) => {
    if (event.type !== 'token_finished') return
    const playerId = String(event.details?.playerId ?? event.playerId)
    if (!order.includes(playerId)) order.push(playerId)
  })
  return order
}

/** Displayed identity must be an active player who has not finished the race. */
export function isDisplayIdentityEligible(state: GameState, playerId: string): boolean {
  if (!state.players.some((player) => player.id === playerId)) return false
  const finished = new Set(getFinishOrderFromEvents(state.events))
  return !finished.has(playerId)
}

export function getFinishedPlayerIds(state: GameState): Set<string> {
  return new Set(getFinishOrderFromEvents(state.events))
}

export function updateMarkerTtlModes(state: GameState): GameState {
  if (!state.rune) return state

  const finished = getFinishedPlayerIds(state)
  const markers = state.rune.markers.map((marker) => {
    if (marker.ttlMode === 'FULL_TABLE_ROUND') return marker
    const identityActive = state.players.some((player) => player.id === marker.displayedIdentityId)
    if (!identityActive || finished.has(marker.displayedIdentityId)) {
      return { ...marker, ttlMode: 'FULL_TABLE_ROUND' as const }
    }
    return marker
  })

  return { ...state, rune: { ...state.rune, markers } }
}
