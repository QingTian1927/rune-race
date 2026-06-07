import { DEFAULT_AUDIO_VOLUME } from './soundIds'

export const AUDIO_VOLUME_STORAGE_KEY = 'rune-race-audio-volume'
export const AUDIO_VOLUME_CHANGE_EVENT = 'rune-race-audio-volume-change'

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AUDIO_VOLUME
  return Math.min(1, Math.max(0, value))
}

export function readAudioVolume(): number {
  try {
    const raw = localStorage.getItem(AUDIO_VOLUME_STORAGE_KEY)
    if (raw === null) return DEFAULT_AUDIO_VOLUME
    const parsed = Number(raw)
    return clampVolume(parsed)
  } catch {
    return DEFAULT_AUDIO_VOLUME
  }
}

export function writeAudioVolume(volume: number): void {
  const next = clampVolume(volume)
  try {
    localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, String(next))
  } catch {
    // ignore private mode / blocked storage
  }
  window.dispatchEvent(new CustomEvent(AUDIO_VOLUME_CHANGE_EVENT, { detail: next }))
}
