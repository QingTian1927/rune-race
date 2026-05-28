import type { PlayerColor } from '@rune-race/shared'
import { PLAYER_COLOR_MAP } from './playerColorStyles'

type YourTurnBannerProps = {
  visible: boolean
  color: PlayerColor
  text?: string
}

export function YourTurnBanner({ visible, color, text = '✦ ĐẾN LƯỢT CỦA BẠN ✦' }: YourTurnBannerProps) {
  const colorStyles = PLAYER_COLOR_MAP[color]

  return (
    <div
      className={[
        'pointer-events-none fixed left-1/2 top-[30%] z-20 -translate-x-1/2 rounded-2xl border-2 bg-white/85 px-8 py-3 text-xl font-black uppercase tracking-widest text-gray-900 shadow-xl backdrop-blur-sm transition-all duration-200',
        colorStyles.border,
        visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0',
      ].join(' ')}
    >
      {text}
    </div>
  )
}
