import { useCallback, useEffect, useState } from 'react'
import {
  getFullscreenElement,
  isFullscreenSupported,
  toggleAppFullscreen,
} from '../lib/fullscreen'

export function useFullscreen() {
  const [active, setActive] = useState(() => Boolean(getFullscreenElement()))
  const [supported] = useState(() => isFullscreenSupported())

  useEffect(() => {
    const sync = () => setActive(Boolean(getFullscreenElement()))
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])

  const toggle = useCallback(async () => {
    try {
      await toggleAppFullscreen()
    } catch {
      // Gesture required or browser blocked fullscreen.
    }
  }, [])

  return { active, supported, toggle }
}
