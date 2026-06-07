export type SoundId =
  | 'ui.click'
  | 'ui.hover'
  | 'game.walk'
  | 'game.kill'
  | 'game.jackpot'
  | 'game.diceShake'

export const DEFAULT_AUDIO_VOLUME = 0.8

/** Per-sound gain relative to the master volume slider. */
export const SOUND_VOLUME_MUL: Partial<Record<SoundId, number>> = {
  'ui.hover': 0.28,
}
