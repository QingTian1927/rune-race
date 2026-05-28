import type { PlayerColor } from '@rune-race/shared'
import { PLAYER_COLOR_MAP } from './playerColorStyles'

type PlayerBadgeProps = {
  color: PlayerColor
  avatarEmoji?: string | null
  isActive?: boolean
  size?: 'sm' | 'md'
}

const SIZE_CLASS = {
  sm: {
    box: 'h-10 w-10 border-2',
    avatar: 'p-1.5 text-lg',
  },
  md: {
    box: 'h-12 w-12 border-[3px]',
    avatar: 'p-2 text-2xl',
  },
} as const

export function PlayerBadge({
  color,
  avatarEmoji,
  isActive = false,
  size = 'md',
}: PlayerBadgeProps) {
  const colorStyles = PLAYER_COLOR_MAP[color]
  const hasAvatar = !!avatarEmoji?.trim()
  const sizeStyles = SIZE_CLASS[size]

  return (
    <div
      className={[
        'flex shrink-0 items-center justify-center rounded-full shadow-md transition-all duration-200',
        sizeStyles.box,
        colorStyles.border,
        hasAvatar ? 'bg-white/95' : colorStyles.bg,
        hasAvatar ? sizeStyles.avatar : '',
        isActive ? `ring-2 ring-offset-1 ${colorStyles.ring} animate-pulse` : '',
      ].join(' ')}
      title={hasAvatar ? undefined : color}
    >
      {hasAvatar ? <span className="leading-none select-none">{avatarEmoji}</span> : null}
    </div>
  )
}
