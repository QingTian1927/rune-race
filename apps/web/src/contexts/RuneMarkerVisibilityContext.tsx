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
import type { BoardMarker, GameState, RuneCardType } from '@rune-race/shared'
import { getDeltaEventsSinceVersion, updateVersionCursor } from '../lib/tokenMotion'
import { resolveLandedCellIds } from '../lib/trackCellId'
import type { MockPathStep } from '../mock/mockGameEngine'

type PendingMarker = {
  marker: BoardMarker
  tokenId: string | null
  cellId: number
  expiresAt: number
}

type RuneMarkerVisibilityContextValue = {
  visibleMarkers: BoardMarker[]
  notifyTokenSteppedOnCell: (
    tokenId: string,
    playerSlot: number,
    step: MockPathStep,
    worldX?: number,
    worldZ?: number,
  ) => void
  notifyMoveAnimationDone: (tokenId: string) => void
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
  fallback: BoardMarker | undefined,
): BoardMarker | null {
  if (fallback) return fallback
  const cellId = event.details?.cellId
  const cardType = event.details?.cardType
  if (typeof cellId !== 'number' || typeof cardType !== 'string') return null
  return {
    markerId,
    cellId,
    cardType: cardType as RuneCardType,
    realPlacerId: '',
    displayedIdentityId: typeof event.playerId === 'string' ? event.playerId : '',
    remainingMarkerRounds: 0,
    ttlMode: 'DISPLAYED_IDENTITY_TURN',
    createdAtPhaseId: '',
  }
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
  const versionCursorRef = useRef({ version: 0, eventCount: 0 })
  const prevMarkersRef = useRef(new Map<string, BoardMarker>())
  const pendingRef = useRef(new Map<string, PendingMarker>())
  const landedCellIdsByTokenRef = useRef(new Map<string, Set<number>>())
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

  const consumeMatchingPending = useCallback(
    (tokenId?: string) => {
      let changed = false
      for (const [markerId, pending] of pendingRef.current) {
        if (tokenId && pending.tokenId && pending.tokenId !== tokenId) continue

        let cellHit = false
        if (tokenId) {
          cellHit = Boolean(landedCellIdsByTokenRef.current.get(tokenId)?.has(pending.cellId))
        } else {
          for (const [candidateTokenId, landed] of landedCellIdsByTokenRef.current) {
            if (pending.tokenId && pending.tokenId !== candidateTokenId) continue
            if (landed.has(pending.cellId)) {
              cellHit = true
              break
            }
          }
        }
        if (!cellHit) continue
        pendingRef.current.delete(markerId)
        changed = true
      }
      if (changed) bump()
    },
    [bump],
  )

  const recordLanding = useCallback(
    (tokenId: string, cellIds: number[]) => {
      if (cellIds.length === 0) return
      let landed = landedCellIdsByTokenRef.current.get(tokenId)
      if (!landed) {
        landed = new Set<number>()
        landedCellIdsByTokenRef.current.set(tokenId, landed)
      }
      cellIds.forEach((cellId) => landed!.add(cellId))
      consumeMatchingPending(tokenId)
    },
    [consumeMatchingPending],
  )

  useEffect(() => {
    const currentMarkers = gameState.rune?.markers ?? []
    const currentMap = new Map(currentMarkers.map((marker) => [marker.markerId, marker]))
    const deltaEvents = getDeltaEventsSinceVersion(gameState, versionCursorRef.current)

    deltaEvents.forEach((event) => {
      if (event.type === 'marker_expired') {
        const markerId = event.details?.markerId
        if (typeof markerId === 'string') {
          pendingRef.current.delete(markerId)
        }
        return
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
      consumeMatchingPending()
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
  }, [bump, consumeMatchingPending, freezeTokenAnimations, gameState, pruneExpiredPending])

  const notifyTokenSteppedOnCell = useCallback(
    (
      tokenId: string,
      playerSlot: number,
      step: MockPathStep,
      worldX?: number,
      worldZ?: number,
    ) => {
      const cellIds = resolveLandedCellIds(playerSlot, step, worldX, worldZ)
      recordLanding(tokenId, cellIds)
    },
    [recordLanding],
  )

  const notifyMoveAnimationDone = useCallback(
    (tokenId: string) => {
      let changed = false
      for (const [markerId, pending] of pendingRef.current) {
        if (pending.tokenId && pending.tokenId !== tokenId) continue
        const landed = landedCellIdsByTokenRef.current.get(tokenId)
        if (pending.tokenId === tokenId || landed?.has(pending.cellId)) {
          pendingRef.current.delete(markerId)
          changed = true
        }
      }
      landedCellIdsByTokenRef.current.delete(tokenId)
      if (changed) bump()
    },
    [bump],
  )

  const visibleMarkers = useMemo(() => {
    void revision
    const live = gameState.rune?.markers ?? []
    const liveIds = new Set(live.map((marker) => marker.markerId))
    const deferred = [...pendingRef.current.values()]
      .map((pending) => pending.marker)
      .filter((marker) => !liveIds.has(marker.markerId))
    return [...live, ...deferred]
  }, [gameState.rune?.markers, revision])

  const value = useMemo(
    () => ({
      visibleMarkers,
      notifyTokenSteppedOnCell,
      notifyMoveAnimationDone,
    }),
    [notifyMoveAnimationDone, notifyTokenSteppedOnCell, visibleMarkers],
  )

  return (
    <RuneMarkerVisibilityContext.Provider value={value}>{children}</RuneMarkerVisibilityContext.Provider>
  )
}

export function useRuneMarkerVisibility() {
  return useContext(RuneMarkerVisibilityContext)
}
