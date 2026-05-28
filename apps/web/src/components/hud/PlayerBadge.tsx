import type { PlayerColor } from '@rune-race/shared'
import { PLAYER_COLOR_MAP } from './playerColorStyles'

type PlayerBadgeProps = {
  color: PlayerColor
  isActive?: boolean
}

export function PlayerBadge({ color, isActive = false }: PlayerBadgeProps) {
  const colorStyles = PLAYER_COLOR_MAP[color]

  return (
    <div
      className={[
        'h-9 w-9 rounded-full border-2 shadow-md transition-all duration-200',
        colorStyles.bg,
        colorStyles.border,
        isActive ? `ring-2 ring-offset-1 ${colorStyles.ring} animate-pulse` : '',
      ].join(' ')}
    />
  )
}
