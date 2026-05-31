import type { PlayerColor } from '@rune-race/shared'
import { HUD_PANEL_LABEL_CLASS, PLAYER_COLOR_MAP } from './playerColorStyles'

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
        'game-hud-banner',
        colorStyles.hudPanel,
        visible ? 'is-visible' : 'is-hidden',
      ].join(' ')}
    >
      <p className={HUD_PANEL_LABEL_CLASS}>{text}</p>
    </div>
  )
}
