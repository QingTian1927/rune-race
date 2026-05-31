import type { PlayerColor } from '@rune-race/shared'

export const PAWN_SLOT_COLORS = ['#4FC870', '#5BA8FF', '#FFD740', '#FF6B60'] as const

export const PLAYER_GRADIENT: Record<PlayerColor, string> = {
  green: 'linear-gradient(135deg,#4FC870,#2E9452)',
  blue: 'linear-gradient(135deg,#5BA8FF,#2E78D0)',
  yellow: 'linear-gradient(135deg,#FFD740,#E8A000)',
  red: 'linear-gradient(135deg,#FF6B60,#D93025)',
}

export function roomPawnDots(playerCount: number, maxPlayers: number) {
  return Array.from({ length: maxPlayers }, (_, i) => ({
    filled: i < playerCount,
    color: PAWN_SLOT_COLORS[i % PAWN_SLOT_COLORS.length],
  }))
}
