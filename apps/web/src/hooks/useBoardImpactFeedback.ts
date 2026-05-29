import { useMemo } from 'react'
import {
  readReducedMotionPreference,
  type BoardImpactFeedback,
  type BoardImpactEvent,
} from '../lib/boardImpact'

/**
 * Default board impact feedback for GameView / BoardScene.
 * Replace `onImpact` with AudioManager when sounds are added, e.g.:
 *
 *   onImpact: (event) => audio.play(IMPACT_SFX[event.kind])
 */
export function useBoardImpactFeedback(
  overrides?: Partial<BoardImpactFeedback>,
): BoardImpactFeedback {
  return useMemo(
    () => ({
      reducedMotion: readReducedMotionPreference(),
      onImpact: (event: BoardImpactEvent) => {
        if (import.meta.env.DEV) {
          console.debug('[board-impact]', event.kind, event.position)
        }
      },
      ...overrides,
    }),
    [overrides],
  )
}
