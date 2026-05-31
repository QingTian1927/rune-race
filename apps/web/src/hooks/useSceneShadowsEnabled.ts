import { useEffect, useState } from 'react'
import { readSceneShadowsEnabled, SCENE_SHADOWS_STORAGE_KEY } from '../lib/sceneShadows'

export function useSceneShadowsEnabled(): boolean {
  const [enabled, setEnabled] = useState(() => readSceneShadowsEnabled())

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SCENE_SHADOWS_STORAGE_KEY) return
      setEnabled(readSceneShadowsEnabled())
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return enabled
}
