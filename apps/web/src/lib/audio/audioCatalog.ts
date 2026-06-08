import clickUrl from '../../../assets/audio/click.m4a'
import hoverUrl from '../../../assets/audio/hover.m4a'
import walkUrl from '../../../assets/audio/walk.m4a'
import killUrl from '../../../assets/audio/kill.m4a'
import jackpotUrl from '../../../assets/audio/jackpot.m4a'
import diceShakeUrl from '../../../assets/audio/diceshake.m4a'
import type { SoundId } from './soundIds'

export const AUDIO_CATALOG: Record<SoundId, string> = {
  'ui.click': clickUrl,
  'ui.hover': hoverUrl,
  'game.walk': walkUrl,
  'game.kill': killUrl,
  'game.jackpot': jackpotUrl,
  'game.diceShake': diceShakeUrl,
}
