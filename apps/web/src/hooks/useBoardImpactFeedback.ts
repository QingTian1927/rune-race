import { useEffect, useMemo, useState } from 'react'
import { audioManager } from '../lib/audio/audioManager'
import {
  type BoardImpactFeedback,
  type BoardImpactEvent,
} from '../lib/boardImpact'
import {
  getGraphicsQualityFlags,
  GRAPHICS_QUALITY_CHANGE_EVENT,
  readGraphicsQuality,
} from '../lib/graphicsQuality'

/** Default board impact feedback for GameView / BoardScene (puffs + gameplay SFX). */
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
        switch (event.kind) {
          case 'step_land':
          case 'spawn_exit':
            audioManager.play('game.walk')
            break
          case 'capture_hit':
            audioManager.play('game.kill')
            break
        }
        if (import.meta.env.DEV) {
          console.debug('[board-impact]', event.kind, event.position)
        }
      },
      ...overrides,
    }),
    [impactPuffsEnabled, overrides],
  )
}
