import type { GameEvent, GameState, Token } from '@rune-race/shared'
import type { MockMoveEventDetails } from '../mock/mockGameEngine'

export type CaptureEventDetails = {
  tokenId: string
  playerId: string
  capturedTokenId: string
  from?: { state: string; position: number }
  to?: { state: string; position: number }
}

export function getDeltaEventsSinceVersion(
  state: GameState,
  versionCursor: { version: number; eventCount: number },
): GameEvent[] {
  if (state.version !== versionCursor.version) {
    return state.events.slice(versionCursor.eventCount)
  }
  return []
}

export function updateVersionCursor(state: GameState, cursor: { version: number; eventCount: number }) {
  cursor.version = state.version
  cursor.eventCount = state.events.length
}

export type MoveAnimationPayload = {
  details: MockMoveEventDetails
  timestamp: number
}

export function extractMoveDetailsFromDelta(
  deltaEvents: GameEvent[],
): Map<string, MoveAnimationPayload> {
  const map = new Map<string, MoveAnimationPayload>()
  deltaEvents.forEach((event) => {
    if (event.type !== 'token_moved') return
    const details = event.details as Partial<MockMoveEventDetails>
    if (!details?.tokenId || !Array.isArray(details.path)) return
    map.set(details.tokenId, {
      details: details as MockMoveEventDetails,
      timestamp: event.timestamp,
    })
  })
  return map
}

export function extractCaptureDetailsFromDelta(
  deltaEvents: GameEvent[],
): Map<string, CaptureEventDetails> {
  const map = new Map<string, CaptureEventDetails>()
  deltaEvents.forEach((event) => {
    if (event.type !== 'token_captured') return
    const details = event.details as Partial<CaptureEventDetails>
    if (!details?.capturedTokenId) return
    map.set(details.capturedTokenId, details as CaptureEventDetails)
  })
  return map
}

export function tokenPositionKey(token: Token): string {
  return `${token.state}:${token.position}`
}
