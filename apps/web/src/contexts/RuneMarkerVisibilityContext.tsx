import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { BoardMarker, GameState, PublicBoardMarker, RuneCardType } from '@rune-race/shared'
import { RUNE_CARD_DEFINITIONS } from '@rune-race/shared'
import { getDeltaEventsSinceVersion, updateVersionCursor } from '../lib/tokenMotion'
import { cellIdForTrackStepBySlot, resolveLandedCellIds } from '../lib/trackCellId'
import type { MockPathStep } from '../mock/mockGameEngine'

export const MARKER_FADE_DURATION_MS = 320

export type DisplayMarker = PublicBoardMarker & {
  /** Client-only ghost retained after server trigger until visual fade completes. */
  isDeferred?: boolean
  fadeOutStartedAt?: number
}

type PendingMarker = {
  marker: PublicBoardMarker
  tokenId: string | null
  cellId: number
  expiresAt: number
  fadeOutStartedAt?: number
}

type RuneMarkerVisibilityContextValue = {
  visibleMarkers: DisplayMarker[]
  notifyMarkerApproachingCell: (
    tokenId: string,
    playerSlot: number,
    step: MockPathStep,
    worldX?: number,
    worldZ?: number,
  ) => void
  notifyTokenSteppedOnCell: (
    tokenId: string,
    playerSlot: number,
    step: MockPathStep,
    worldX?: number,
    worldZ?: number,
  ) => void
  notifyTeleportBurstStarted: (
    tokenId: string,
    playerSlot: number,
    targetStep: MockPathStep,
    remainingPathSteps: MockPathStep[],
  ) => void
  notifyMoveAnimationDone: (tokenId: string) => void
  notifyMarkerFadeComplete: (markerId: string) => void
}

const PENDING_MARKER_TTL_MS = 12_000

const RuneMarkerVisibilityContext = createContext<RuneMarkerVisibilityContextValue | null>(null)

function findMoveTokenIdForTrigger(
  deltaEvents: GameState['events'],
  triggeredPlayerId: string,
): string | null {
  for (const event of deltaEvents) {
    if (event.type !== 'token_moved') continue
    if (event.playerId !== triggeredPlayerId) continue
    const tokenId = event.details?.tokenId
    if (typeof tokenId === 'string') return tokenId
  }
  return null
}

function markerFromTriggerEvent(
  markerId: string,
  event: GameState['events'][number],
  fallback: PublicBoardMarker | undefined,
): PublicBoardMarker | null {
  if (fallback) return fallback
  const cellId = event.details?.cellId
  const cardType = event.details?.cardType
  if (typeof cellId !== 'number' || typeof cardType !== 'string') return null
  const def = RUNE_CARD_DEFINITIONS[cardType as RuneCardType]
  return {
    markerId,
    cellId,
    displayedIdentityId: typeof event.playerId === 'string' ? event.playerId : '',
    triggerMode: def.triggerMode ?? 'PASS_THROUGH',
  }
}

/**
 * Online snapshots already carry PublicBoardMarker; local mode passes full
 * BoardMarker (no triggerMode) — derive it from the card definition.
 */
function toDisplayableMarker(marker: BoardMarker | PublicBoardMarker): PublicBoardMarker {
  if ('triggerMode' in marker) return marker
  const def = RUNE_CARD_DEFINITIONS[marker.cardType]
  return {
    markerId: marker.markerId,
    cellId: marker.cellId,
    displayedIdentityId: marker.displayedIdentityId,
    triggerMode: def.triggerMode ?? 'PASS_THROUGH',
  }
}

function cellIdsForPathSteps(playerSlot: number, steps: MockPathStep[]): Set<number> {
  const ids = new Set<number>()
  steps.forEach((step) => {
    const cellId = cellIdForTrackStepBySlot(playerSlot, step)
    if (cellId !== null) ids.add(cellId)
  })
  return ids
}

export function RuneMarkerVisibilityProvider({
  gameState,
  freezeTokenAnimations = false,
  children,
}: {
  gameState: GameState
  freezeTokenAnimations?: boolean
  children: ReactNode
}) {
  const versionCursorRef = useRef({ version: -1, eventCount: 0 })
  const skipHistoryRef = useRef(true)
  const prevMarkersRef = useRef(new Map<string, PublicBoardMarker>())
  const pendingRef = useRef(new Map<string, PendingMarker>())
  const [revision, setRevision] = useState(0)

  const bump = useCallback(() => {
    setRevision((value) => value + 1)
  }, [])

  const pruneExpiredPending = useCallback(() => {
    const now = Date.now()
    let changed = false
    for (const [markerId, pending] of pendingRef.current) {
      if (pending.expiresAt <= now) {
        pendingRef.current.delete(markerId)
        changed = true
      }
    }
    if (changed) bump()
  }, [bump])

  const startFadeForCellIds = useCallback(
    (tokenId: string, cellIds: Iterable<number>) => {
      const targets = new Set(cellIds)
      if (targets.size === 0) return
      let changed = false
      for (const [markerId, pending] of pendingRef.current) {
        if (pending.tokenId && pending.tokenId !== tokenId) continue
        if (!targets.has(pending.cellId)) continue
        if (pending.fadeOutStartedAt) continue
        pending.fadeOutStartedAt = Date.now()
        pendingRef.current.set(markerId, pending)
        changed = true
      }
      if (changed) bump()
    },
    [bump],
  )

  const removePendingMarker = useCallback(
    (markerId: string) => {
      if (!pendingRef.current.delete(markerId)) return
      bump()
    },
    [bump],
  )

  const notifyMarkerFadeComplete = useCallback(
    (markerId: string) => {
      removePendingMarker(markerId)
    },
    [removePendingMarker],
  )

  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false
      updateVersionCursor(gameState, versionCursorRef.current)
      prevMarkersRef.current = new Map(
        (gameState.rune?.markers ?? []).map((marker) => [
          marker.markerId,
          toDisplayableMarker(marker),
        ]),
      )
      return
    }

    const currentMarkers = gameState.rune?.markers ?? []
    const currentMap = new Map(
      currentMarkers.map((marker) => [marker.markerId, toDisplayableMarker(marker)]),
    )
    const deltaEvents = freezeTokenAnimations
      ? []
      : getDeltaEventsSinceVersion(gameState, versionCursorRef.current)

    deltaEvents.forEach((event) => {
      if (event.type === 'marker_expired') {
        const markerId = event.details?.markerId
        if (typeof markerId === 'string') {
          pendingRef.current.delete(markerId)
        }
      }
    })

    deltaEvents.forEach((event) => {
      if (event.type !== 'marker_triggered') return
      const markerId = event.details?.markerId
      if (typeof markerId !== 'string') return
      if (currentMap.has(markerId)) return

      const marker = markerFromTriggerEvent(
        markerId,
        event,
        prevMarkersRef.current.get(markerId),
      )
      if (!marker) return

      const tokenId = findMoveTokenIdForTrigger(deltaEvents, event.playerId)
      pendingRef.current.set(markerId, {
        marker,
        tokenId,
        cellId: marker.cellId,
        expiresAt: Date.now() + PENDING_MARKER_TTL_MS,
      })
    })

    if (!freezeTokenAnimations) {
      updateVersionCursor(gameState, versionCursorRef.current)
    }

    for (const markerId of [...pendingRef.current.keys()]) {
      if (currentMap.has(markerId)) {
        pendingRef.current.delete(markerId)
      }
    }

    prevMarkersRef.current = currentMap
    pruneExpiredPending()
    bump()
  }, [bump, freezeTokenAnimations, gameState, pruneExpiredPending])

  const notifyMarkerApproachingCell = useCallback(
    (
      tokenId: string,
      playerSlot: number,
      step: MockPathStep,
      worldX?: number,
      worldZ?: number,
    ) => {
      const cellIds = resolveLandedCellIds(playerSlot, step, worldX, worldZ)
      startFadeForCellIds(tokenId, cellIds)
    },
    [startFadeForCellIds],
  )

  const notifyTokenSteppedOnCell = useCallback(
    (
      tokenId: string,
      playerSlot: number,
      step: MockPathStep,
      worldX?: number,
      worldZ?: number,
    ) => {
      const cellIds = resolveLandedCellIds(playerSlot, step, worldX, worldZ)
      startFadeForCellIds(tokenId, cellIds)
    },
    [startFadeForCellIds],
  )

  const notifyTeleportBurstStarted = useCallback(
    (
      tokenId: string,
      playerSlot: number,
      _targetStep: MockPathStep,
      remainingPathSteps: MockPathStep[],
    ) => {
      const remainingCellIds = cellIdsForPathSteps(playerSlot, remainingPathSteps)
      let changed = false
      for (const [markerId, pending] of pendingRef.current) {
        if (pending.tokenId && pending.tokenId !== tokenId) continue
        if (remainingCellIds.has(pending.cellId)) continue
        if (pending.fadeOutStartedAt) continue
        pending.fadeOutStartedAt = Date.now()
        pendingRef.current.set(markerId, pending)
        changed = true
      }
      if (changed) bump()
    },
    [bump],
  )

  const notifyMoveAnimationDone = useCallback(
    (tokenId: string) => {
      let changed = false
      for (const [markerId, pending] of pendingRef.current) {
        if (pending.tokenId && pending.tokenId !== tokenId) continue
        if (!pending.fadeOutStartedAt) {
          pending.fadeOutStartedAt = Date.now()
          pendingRef.current.set(markerId, pending)
        }
        changed = true
      }
      if (changed) bump()
    },
    [bump],
  )

  const visibleMarkers = useMemo((): DisplayMarker[] => {
    void revision
    const live = (gameState.rune?.markers ?? []).map(toDisplayableMarker)
    const liveIds = new Set(live.map((marker) => marker.markerId))
    const deferred: DisplayMarker[] = [...pendingRef.current.values()]
      .filter((pending) => !liveIds.has(pending.marker.markerId))
      .map((pending) => ({
        ...pending.marker,
        isDeferred: true,
        fadeOutStartedAt: pending.fadeOutStartedAt,
      }))
    return [...live, ...deferred]
  }, [gameState.rune?.markers, revision])

  const value = useMemo(
    () => ({
      visibleMarkers,
      notifyMarkerApproachingCell,
      notifyTokenSteppedOnCell,
      notifyTeleportBurstStarted,
      notifyMoveAnimationDone,
      notifyMarkerFadeComplete,
    }),
    [
      notifyMarkerApproachingCell,
      notifyMarkerFadeComplete,
      notifyMoveAnimationDone,
      notifyTeleportBurstStarted,
      notifyTokenSteppedOnCell,
      visibleMarkers,
    ],
  )

  return (
    <RuneMarkerVisibilityContext.Provider value={value}>{children}</RuneMarkerVisibilityContext.Provider>
  )
}

export function useRuneMarkerVisibility() {
  return useContext(RuneMarkerVisibilityContext)
}
