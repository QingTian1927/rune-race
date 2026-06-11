import { isBotAvatarSentinel, type PlayerColor } from '@rune-race/shared'
import { PLAYER_COLOR_MAP } from './playerColorStyles'

type PlayerBadgeProps = {
  color: PlayerColor
  avatarEmoji?: string | null
  isActive?: boolean
  size?: 'xs' | 'sm' | 'md'
}

export function PlayerBadge({
  color,
  avatarEmoji,
  isActive = false,
  size = 'md',
}: PlayerBadgeProps) {
  const colorStyles = PLAYER_COLOR_MAP[color]
  const isBotAvatar = isBotAvatarSentinel(avatarEmoji)
  const hasEmojiAvatar = !!avatarEmoji?.trim() && !isBotAvatar
  const hasAvatar = isBotAvatar || hasEmojiAvatar

  return (
    <div
      className={[
        'game-hud-orb',
        size === 'xs' ? 'game-hud-orb--xs' : '',
        size === 'sm' ? 'game-hud-orb--sm' : '',
        hasAvatar ? 'game-hud-orb--avatar' : '',
        isBotAvatar ? 'game-hud-orb--bot' : '',
        isActive ? 'game-hud-orb--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={hasAvatar ? undefined : { background: colorStyles.gradient }}
      title={hasAvatar ? undefined : color}
    >
      {isBotAvatar ? (
        <i className="bi bi-robot game-hud-orb-robot" aria-hidden />
      ) : hasEmojiAvatar ? (
        <span className="game-hud-orb-emoji">{avatarEmoji}</span>
      ) : null}
    </div>
  )
}
