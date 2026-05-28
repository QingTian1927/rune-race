import type { PlayerColor } from '@rune-race/shared'

/** HUD panel section label (BẠN, LƯỢT HIỆN TẠI, VỀ ĐÍCH). */
export const HUD_PANEL_LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-wider text-gray-400'

/** HUD player display name. */
export const HUD_PLAYER_NAME_CLASS = 'text-base font-bold leading-snug'

export const PLAYER_COLOR_MAP: Record<
  PlayerColor,
  { border: string; text: string; bg: string; ring: string }
> = {
  red: {
    border: 'border-red-400',
    text: 'text-red-600',
    bg: 'bg-red-500',
    ring: 'ring-red-400',
  },
  blue: {
    border: 'border-blue-400',
    text: 'text-blue-600',
    bg: 'bg-blue-500',
    ring: 'ring-blue-400',
  },
  green: {
    border: 'border-green-400',
    text: 'text-green-600',
    bg: 'bg-green-500',
    ring: 'ring-green-400',
  },
  yellow: {
    border: 'border-yellow-400',
    text: 'text-yellow-600',
    bg: 'bg-yellow-400',
    ring: 'ring-yellow-400',
  },
}
