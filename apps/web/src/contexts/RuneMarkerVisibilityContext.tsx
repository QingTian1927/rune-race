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
import type { BoardMarker, GameState } from '@rune-race/shared'
import { getDeltaEventsSinceVersion, updateVersionCursor } from '../lib/tokenMotion'
import { resolveLandedCellIds } from '../lib/trackCellId'
import type { MockPathStep } from '../mock/mockGameEngine'

type PendingMarker = {
  marker: BoardMarker
  tokenId: string
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

  const consumeMatchingPending = useCallback(
    (tokenId?: string) => {
      let changed = false
      for (const [markerId, pending] of pendingRef.current) {
        if (tokenId && pending.tokenId !== tokenId) continue
        const landed = landedCellIdsByTokenRef.current.get(pending.tokenId)
        if (!landed?.has(pending.marker.cellId)) continue
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
    updateVersionCursor(gameState, versionCursorRef.current)

    deltaEvents.forEach((event) => {
      if (event.type === 'marker_expired') {
        const markerId = event.details?.markerId
        if (typeof markerId === 'string') {
          pendingRef.current.delete(markerId)
        }
        return
      }

      if (event.type === 'horse_status_changed' && event.details?.status === 'sent_home') {
        const tokenId = event.details?.tokenId
        if (typeof tokenId !== 'string') return
        for (const [markerId, pending] of pendingRef.current) {
          if (pending.tokenId === tokenId) {
            pendingRef.current.delete(markerId)
          }
        }
      }
    })

    if (!freezeTokenAnimations) {
      deltaEvents.forEach((event) => {
        if (event.type !== 'marker_triggered') return
        const markerId = event.details?.markerId
        if (typeof markerId !== 'string') return
        if (currentMap.has(markerId)) return

        // Send-home removes the token from the track — hide marker as soon as it triggers.
        if (event.details?.cardType === 'SEND_HOME') {
          pendingRef.current.delete(markerId)
          return
        }

        const marker = prevMarkersRef.current.get(markerId)
        if (!marker) return

        const tokenId = findMoveTokenIdForTrigger(deltaEvents, event.playerId)
        if (!tokenId) return

        pendingRef.current.set(markerId, { marker, tokenId })
        consumeMatchingPending(tokenId)
      })
    } else {
      pendingRef.current.clear()
    }

    for (const markerId of [...pendingRef.current.keys()]) {
      if (currentMap.has(markerId)) {
        pendingRef.current.delete(markerId)
      }
    }

    prevMarkersRef.current = currentMap
    bump()
  }, [bump, consumeMatchingPending, freezeTokenAnimations, gameState])

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
        if (pending.tokenId !== tokenId) continue
        pendingRef.current.delete(markerId)
        changed = true
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
