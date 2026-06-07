import { AUDIO_CATALOG } from './audioCatalog'
import { AUDIO_VOLUME_CHANGE_EVENT, readAudioVolume } from './audioSettings'
import { SOUND_VOLUME_MUL, type SoundId } from './soundIds'

const POOL_SIZE = 8
const HOVER_MIN_INTERVAL_MS = 140

type PlayOptions = {
  volumeMul?: number
}

class AudioManager {
  private volume = readAudioVolume()
  private unlocked = false
  private pools = new Map<SoundId, HTMLAudioElement[]>()
  private poolCursor = new Map<SoundId, number>()
  private lastHoverAt = 0

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener(AUDIO_VOLUME_CHANGE_EVENT, this.onVolumeChange as EventListener)
    }
  }

  private onVolumeChange = (event: Event) => {
    const detail = (event as CustomEvent<number>).detail
    this.volume = typeof detail === 'number' ? detail : readAudioVolume()
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume))
  }

  getVolume(): number {
    return this.volume
  }

  unlock(): void {
    if (this.unlocked) return
    this.unlocked = true

    for (const soundId of Object.keys(AUDIO_CATALOG) as SoundId[]) {
      const audio = this.borrow(soundId)
      audio.volume = 0
      const playPromise = audio.play()
      if (playPromise) {
        void playPromise
          .then(() => {
            audio.pause()
            audio.currentTime = 0
          })
          .catch(() => {
            // Browser may still block until a later gesture.
          })
      }
    }
  }

  play(soundId: SoundId, options?: PlayOptions): void {
    if (this.volume <= 0) return

    const audio = this.borrow(soundId)
    const soundMul = SOUND_VOLUME_MUL[soundId] ?? 1
    const effectiveVolume = this.volume * soundMul * (options?.volumeMul ?? 1)
    audio.volume = Math.min(1, Math.max(0, effectiveVolume))
    audio.currentTime = 0
    void audio.play().catch(() => {
      // Ignore autoplay or missing-media errors after a failed unlock.
    })
  }

  playHover(): void {
    const now = performance.now()
    if (now - this.lastHoverAt < HOVER_MIN_INTERVAL_MS) return
    this.lastHoverAt = now
    this.play('ui.hover')
  }

  private borrow(soundId: SoundId): HTMLAudioElement {
    let pool = this.pools.get(soundId)
    if (!pool) {
      pool = Array.from({ length: POOL_SIZE }, () => {
        const audio = new Audio(AUDIO_CATALOG[soundId])
        audio.preload = 'auto'
        return audio
      })
      this.pools.set(soundId, pool)
    }

    const cursor = this.poolCursor.get(soundId) ?? 0
    const audio = pool[cursor]
    this.poolCursor.set(soundId, (cursor + 1) % pool.length)
    return audio
  }
}

export const audioManager = new AudioManager()
