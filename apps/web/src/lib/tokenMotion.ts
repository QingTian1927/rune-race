import type { GameEvent, GameState, Token } from '@rune-race/shared'
import type { MockMoveEventDetails, MockPathStep } from '../mock/mockGameEngine'

export type CaptureEventDetails = {
  tokenId: string
  playerId: string
  capturedTokenId: string
  from?: { state: string; position: number }
  to?: { state: string; position: number }
}

export type SentHomeEventDetails = {
  tokenId: string
  status: 'sent_home'
  from?: { state: string; position: number }
  to?: { state: string; position: number }
}

export type SwapTokenStep = { state: string; position: number }

export type SwapEventDetails = {
  activatorTokenId: string
  targetTokenId: string
  activatorFrom: SwapTokenStep
  activatorTo: SwapTokenStep
  targetFrom: SwapTokenStep
  targetTo: SwapTokenStep
  /** True when the engine swapped without a manual target choice. */
  automatic?: boolean
}

export type ShieldConsumedPayload = {
  tokenId: string
  key: string
  timestamp: number
  at?: SwapTokenStep
}

export type ShieldGrantedPayload = {
  tokenId: string
  key: string
  timestamp: number
  at?: SwapTokenStep
}

export function stepsEqual(a: SwapTokenStep, b: SwapTokenStep): boolean {
  return a.state === b.state && a.position === b.position
}

/** Split a move path so shield-break can play after the trap cell waypoint. */
export function splitPathAtStep(
  path: MockPathStep[],
  at?: SwapTokenStep,
): { before: MockPathStep[]; after: MockPathStep[] } | null {
  if (!at || path.length === 0) {
    return null
  }
  const index = path.findIndex((step) => stepsEqual(step, at))
  if (index < 0) {
    return null
  }
  const before = path.slice(0, index + 1)
  const after = path.slice(index + 1)
  return { before, after }
}

/** Split path for shield grant then trap consume in one move. */
export function splitPathForShieldGrantAndConsume(
  path: MockPathStep[],
  grantAt: SwapTokenStep,
  consumeAt: SwapTokenStep,
): { paths: MockPathStep[][]; pauseAfterSegment: Array<'shield_grant' | 'shield_break' | null> } | null {
  const grantIdx = path.findIndex((step) => stepsEqual(step, grantAt))
  const consumeIdx = path.findIndex((step) => stepsEqual(step, consumeAt))
  if (grantIdx < 0 || consumeIdx < 0 || grantIdx >= consumeIdx) {
    return null
  }

  const paths: MockPathStep[][] = [path.slice(0, grantIdx + 1)]
  const pauseAfterSegment: Array<'shield_grant' | 'shield_break' | null> = ['shield_grant']

  paths.push(path.slice(grantIdx + 1, consumeIdx + 1))
  pauseAfterSegment.push('shield_break')

  if (consumeIdx + 1 < path.length) {
    paths.push(path.slice(consumeIdx + 1))
    pauseAfterSegment.push(null)
  }

  return { paths, pauseAfterSegment }
}

export function getDeltaEventsSinceVersion(
  state: GameState,
  versionCursor: { version: number; eventCount: number },
): GameEvent[] {
  if (state.version !== versionCursor.version) {
    return state.events.slice(versionCursor.eventCount)
  }
  if (state.events.length > versionCursor.eventCount) {
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

export type SentHomeAnimationPayload = {
  details: SentHomeEventDetails
  timestamp: number
  key: string
}

export function extractSentHomeDetailsFromDelta(
  deltaEvents: GameEvent[],
): Map<string, SentHomeAnimationPayload> {
  const map = new Map<string, SentHomeAnimationPayload>()
  deltaEvents.forEach((event) => {
    if (event.type !== 'horse_status_changed') return
    const details = event.details as Partial<SentHomeEventDetails>
    if (details?.status !== 'sent_home' || !details.tokenId || !details.from || !details.to) return
    map.set(details.tokenId, {
      details: details as SentHomeEventDetails,
      timestamp: event.timestamp,
      key: `${details.tokenId}:sent-home:${event.timestamp}`,
    })
  })
  return map
}

export function extractShieldConsumedFromDelta(
  deltaEvents: GameEvent[],
): Map<string, ShieldConsumedPayload> {
  const map = new Map<string, ShieldConsumedPayload>()
  deltaEvents.forEach((event) => {
    if (event.type !== 'horse_status_changed') return
    const details = event.details as {
      status?: string
      tokenId?: string
      at?: SwapTokenStep
    }
    if (details.status !== 'shield_consumed' || !details.tokenId) return
    map.set(details.tokenId, {
      tokenId: details.tokenId,
      key: `${details.tokenId}:shield-break:${event.timestamp}`,
      timestamp: event.timestamp,
      at: details.at,
    })
  })
  return map
}

export function extractShieldGrantedFromDelta(
  deltaEvents: GameEvent[],
): Map<string, ShieldGrantedPayload> {
  const map = new Map<string, ShieldGrantedPayload>()
  deltaEvents.forEach((event) => {
    if (event.type !== 'horse_status_changed') return
    const details = event.details as {
      status?: string
      tokenId?: string
      at?: SwapTokenStep
    }
    if (details.status !== 'shield_granted' || !details.tokenId) return
    map.set(details.tokenId, {
      tokenId: details.tokenId,
      key: `${details.tokenId}:shield-grant:${event.timestamp}`,
      timestamp: event.timestamp,
      at: details.at,
    })
  })
  return map
}

export function extractSwapDetailsFromDelta(deltaEvents: GameEvent[]): SwapEventDetails | null {
  for (let index = deltaEvents.length - 1; index >= 0; index -= 1) {
    const event = deltaEvents[index]
    if (event.type !== 'token_swapped') continue
    const details = event.details as Partial<SwapEventDetails>
    if (
      !details.activatorTokenId ||
      !details.targetTokenId ||
      !details.activatorFrom ||
      !details.activatorTo ||
      !details.targetFrom ||
      !details.targetTo
    ) {
      continue
    }
    return details as SwapEventDetails
  }
  return null
}

export function tokenPositionKey(token: Token): string {
  return `${token.state}:${token.position}`
}
