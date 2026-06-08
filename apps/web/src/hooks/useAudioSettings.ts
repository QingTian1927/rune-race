import { useCallback, useEffect, useState } from 'react'
import { audioManager } from '../lib/audio/audioManager'
import {
  AUDIO_VOLUME_CHANGE_EVENT,
  AUDIO_VOLUME_STORAGE_KEY,
  readAudioVolume,
  writeAudioVolume,
} from '../lib/audio/audioSettings'

export function useAudioSettings(): {
  volume: number
  setVolume: (volume: number) => void
} {
  const [volume, setVolumeState] = useState(() => readAudioVolume())

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail
      const next = typeof detail === 'number' ? detail : readAudioVolume()
      setVolumeState(next)
      audioManager.setVolume(next)
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUDIO_VOLUME_STORAGE_KEY) return
      const next = readAudioVolume()
      setVolumeState(next)
      audioManager.setVolume(next)
    }

    audioManager.setVolume(readAudioVolume())
    window.addEventListener(AUDIO_VOLUME_CHANGE_EVENT, onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(AUDIO_VOLUME_CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setVolume = useCallback((next: number) => {
    writeAudioVolume(next)
    audioManager.setVolume(next)
    setVolumeState(next)
  }, [])

  return { volume, setVolume }
}
