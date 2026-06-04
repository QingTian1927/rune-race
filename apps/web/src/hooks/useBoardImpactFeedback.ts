import { useEffect, useMemo, useState } from 'react'
import {
  type BoardImpactFeedback,
  type BoardImpactEvent,
} from '../lib/boardImpact'
import {
  getGraphicsQualityFlags,
  GRAPHICS_QUALITY_CHANGE_EVENT,
  readGraphicsQuality,
} from '../lib/graphicsQuality'

/**
 * Default board impact feedback for GameView / BoardScene.
 * Replace `onImpact` with AudioManager when sounds are added, e.g.:
 *
 *   onImpact: (event) => audio.play(IMPACT_SFX[event.kind])
 */
export function useBoardImpactFeedback(
  overrides?: Partial<BoardImpactFeedback>,
): BoardImpactFeedback {
  const [quality, setQuality] = useState(() => readGraphicsQuality())

  useEffect(() => {
    const onChange = () => setQuality(readGraphicsQuality())
    window.addEventListener(GRAPHICS_QUALITY_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(GRAPHICS_QUALITY_CHANGE_EVENT, onChange)
  }, [])

  const impactPuffsEnabled = getGraphicsQualityFlags(quality).impactPuffs

  return useMemo(
    () => ({
      reducedMotion: !impactPuffsEnabled,
      onImpact: (event: BoardImpactEvent) => {
        if (import.meta.env.DEV) {
          console.debug('[board-impact]', event.kind, event.position)
        }
      },
      ...overrides,
    }),
    [impactPuffsEnabled, overrides],
  )
}
