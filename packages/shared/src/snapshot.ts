import type { ClientGameSnapshot, GameEvent, GameState } from './types/game.js'
import type { BoardMarker, PublicBoardMarker, RuneClientView } from './types/rune.js'
import { RUNE_CARD_DEFINITIONS } from './types/rune-definitions.js'

export function toPublicBoardMarker(marker: BoardMarker): PublicBoardMarker {
  return {
    markerId: marker.markerId,
    cellId: marker.cellId,
    displayedIdentityId: marker.displayedIdentityId,
    triggerMode: RUNE_CARD_DEFINITIONS[marker.cardType].triggerMode,
  }
}

export function buildRuneClientView(state: GameState, viewerPlayerId: string): RuneClientView | null {
  if (!state.rune) return null
  return {
    myMarkers: state.rune.markers
      .filter((m) => m.realPlacerId === viewerPlayerId)
      .map((m) => ({ markerId: m.markerId, cardType: m.cardType })),
  }
}

export function toPublicGameState(state: GameState): GameState {
  if (!state.rune) {
    return state
  }

  const publicMarkers: PublicBoardMarker[] = state.rune.markers.map(toPublicBoardMarker)

  return {
    ...state,
    rune: {
      ...state.rune,
      markers: publicMarkers as unknown as GameState['rune'] extends infer R
        ? R extends { markers: infer M }
          ? M
          : never
        : never,
    },
  }
}

export function buildClientGameSnapshot(
  state: GameState,
  viewerPlayerId: string,
  events: GameEvent[],
): ClientGameSnapshot {
  return {
    version: state.version,
    state: toPublicGameState(state),
    events,
    runeView: buildRuneClientView(state, viewerPlayerId),
  }
}
