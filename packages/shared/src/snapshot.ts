import type { ClientGameSnapshot, GameEvent, GameState } from './types/game.js'
import type { BoardMarker, PublicBoardMarker, RuneClientView, RunePlayerState } from './types/rune.js'
import { RUNE_CARD_DEFINITIONS } from './types/rune-definitions.js'

export function toPublicBoardMarker(marker: BoardMarker): PublicBoardMarker {
  const def = RUNE_CARD_DEFINITIONS[marker.cardType]
  return {
    markerId: marker.markerId,
    cellId: marker.cellId,
    displayedIdentityId: marker.displayedIdentityId,
    triggerMode: def.triggerMode ?? 'PASS_THROUGH',
  }
}

export function buildRuneClientView(state: GameState, viewerPlayerId: string): RuneClientView | null {
  if (!state.rune) return null
  const viewerRune = state.rune.players[viewerPlayerId]
  return {
    myMarkers: state.rune.markers
      .filter((m) => m.realPlacerId === viewerPlayerId)
      .map((m) => ({ markerId: m.markerId, cardType: m.cardType })),
    myPendingDraw: viewerRune?.pendingDraw ?? null,
  }
}

/** Opponent rune state with all private fields hidden (spec §4.4, §7). */
function toOpponentRunePlayerState(player: RunePlayerState): RunePlayerState {
  return {
    drawCount: player.drawCount,
    hand: [],
    pendingDraw: null,
    hasClaimableHonestyReward: false,
    honestPlacementStreak: 0,
  }
}

export function toPublicGameState(state: GameState, viewerPlayerId: string): GameState {
  if (!state.rune) {
    return state
  }

  const events = redactEventsForViewer(state.events, viewerPlayerId)

  const publicMarkers: PublicBoardMarker[] = state.rune.markers.map(toPublicBoardMarker)

  const players: Record<string, RunePlayerState> = {}
  for (const [playerId, player] of Object.entries(state.rune.players)) {
    players[playerId] = playerId === viewerPlayerId ? player : toOpponentRunePlayerState(player)
  }

  // honestyByPlayer reveals impersonation usage — keep only the viewer's own entry.
  const placement = state.rune.placement
    ? {
        ...state.rune.placement,
        honestyByPlayer: state.rune.placement.honestyByPlayer[viewerPlayerId]
          ? { [viewerPlayerId]: state.rune.placement.honestyByPlayer[viewerPlayerId]! }
          : {},
      }
    : null

  return {
    ...state,
    events,
    rune: {
      ...state.rune,
      markers: publicMarkers as unknown as GameState['rune'] extends infer R
        ? R extends { markers: infer M }
          ? M
          : never
        : never,
      players,
      placement,
    },
  }
}

/**
 * Strip card secrets from events before sending to a viewer who does not own them.
 * Returns null to drop the event entirely for this viewer.
 */
function redactEventForViewer(event: GameEvent, viewerPlayerId: string): GameEvent | null {
  const isOwn = event.playerId === viewerPlayerId

  switch (event.type) {
    case 'card_draw_preview':
    case 'marker_place_rejected':
    case 'honesty_reward_available':
    case 'honesty_reward_selected':
      return isOwn ? event : null
    case 'cards_drawn': {
      if (isOwn) return event
      const { cardTypes: _cardTypes, ...details } = event.details
      return { ...event, details }
    }
    case 'held_card_expired':
      return isOwn ? event : null
    case 'marker_placed': {
      if (isOwn) return event
      const { heldCardId: _heldCardId, ...details } = event.details
      const displayedIdentityId = details.displayedIdentityId
      return {
        ...event,
        // Never leak the real placer; attribute the marker to its displayed identity.
        playerId: typeof displayedIdentityId === 'string' ? displayedIdentityId : '',
        details,
      }
    }
    case 'honesty_reward_granted': {
      if (isOwn) return event
      const { cardType: _cardType, heldCardId: _heldCardId, ...details } = event.details
      return { ...event, details }
    }
    default:
      return event
  }
}

export function redactEventsForViewer(events: GameEvent[], viewerPlayerId: string): GameEvent[] {
  const redacted: GameEvent[] = []
  for (const event of events) {
    const next = redactEventForViewer(event, viewerPlayerId)
    if (next) redacted.push(next)
  }
  return redacted
}

export function buildClientGameSnapshot(
  state: GameState,
  viewerPlayerId: string,
  events: GameEvent[],
): ClientGameSnapshot {
  return {
    version: state.version,
    state: toPublicGameState(state, viewerPlayerId),
    events: redactEventsForViewer(events, viewerPlayerId),
    runeView: buildRuneClientView(state, viewerPlayerId),
  }
}
