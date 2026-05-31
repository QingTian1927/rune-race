import type { PlayerColor } from '@rune-race/shared'
import { PLAYER_COLOR_MAP } from './playerColorStyles'

type PlayerBadgeProps = {
  color: PlayerColor
  avatarEmoji?: string | null
  isActive?: boolean
  size?: 'sm' | 'md'
}

export function PlayerBadge({
  color,
  avatarEmoji,
  isActive = false,
  size = 'md',
}: PlayerBadgeProps) {
  const colorStyles = PLAYER_COLOR_MAP[color]
  const hasAvatar = !!avatarEmoji?.trim()

  return (
    <div
      className={[
        'game-hud-orb',
        size === 'sm' ? 'game-hud-orb--sm' : '',
        hasAvatar ? 'game-hud-orb--avatar' : '',
        isActive ? 'game-hud-orb--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={hasAvatar ? undefined : { background: colorStyles.gradient }}
      title={hasAvatar ? undefined : color}
    >
      {hasAvatar ? (
        <span className="game-hud-orb-emoji">{avatarEmoji}</span>
      ) : null}
    </div>
  )
}
