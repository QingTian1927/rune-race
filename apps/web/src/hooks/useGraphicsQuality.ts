import { useCallback, useEffect, useState } from 'react'
import {
  GRAPHICS_QUALITY_CHANGE_EVENT,
  readGraphicsQuality,
  writeGraphicsQuality,
  type GraphicsQuality,
} from '../lib/graphicsQuality'

export function useGraphicsQuality(): {
  quality: GraphicsQuality
  setQuality: (quality: GraphicsQuality) => void
} {
  const [quality, setQualityState] = useState<GraphicsQuality>(() => readGraphicsQuality())

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<GraphicsQuality>).detail
      setQualityState(detail ?? readGraphicsQuality())
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'rune-race-graphics-quality') return
      setQualityState(readGraphicsQuality())
    }

    window.addEventListener(GRAPHICS_QUALITY_CHANGE_EVENT, onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(GRAPHICS_QUALITY_CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setQuality = useCallback((next: GraphicsQuality) => {
    writeGraphicsQuality(next)
    setQualityState(next)
  }, [])

  return { quality, setQuality }
}
