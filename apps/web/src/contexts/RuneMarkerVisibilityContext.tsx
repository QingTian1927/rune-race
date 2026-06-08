import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import type { BoardMarker, GameState } from '@rune-race/shared'
import type { MockPathStep } from '../mock/mockGameEngine'

type RuneMarkerVisibilityContextValue = {
  visibleMarkers: BoardMarker[]
  /** @deprecated Markers hide on trigger per spec; kept for BoardPieces hook compatibility. */
  notifyTokenSteppedOnCell: (
    tokenId: string,
    playerSlot: number,
    step: MockPathStep,
    worldX?: number,
    worldZ?: number,
  ) => void
  /** @deprecated Markers hide on trigger per spec; kept for BoardPieces hook compatibility. */
  notifyMoveAnimationDone: (tokenId: string) => void
}

const RuneMarkerVisibilityContext = createContext<RuneMarkerVisibilityContextValue | null>(null)

/**
 * Spec §8–10: markers disappear immediately when triggered or expired.
 * Only authoritative `gameState.rune.markers` are shown (no client-side retention).
 */
export function RuneMarkerVisibilityProvider({
  gameState,
  children,
}: {
  gameState: GameState
  freezeTokenAnimations?: boolean
  children: ReactNode
}) {
  const visibleMarkers = useMemo(
    () => gameState.rune?.markers ?? [],
    [gameState.rune?.markers],
  )

  const notifyTokenSteppedOnCell = useCallback(() => {}, [])
  const notifyMoveAnimationDone = useCallback(() => {}, [])

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
