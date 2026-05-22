import type { Player, PlayerColor } from '@rune-race/shared'
import { PLAYER_COLORS } from '@rune-race/shared'

/** Board layout slot (0–3) for a player color on the physical board. */
export function boardSlotForColor(color: PlayerColor): number {
  const slot = PLAYER_COLORS.indexOf(color)
  return slot >= 0 ? slot : 0
}

export function boardSlotForPlayer(players: Player[], playerId: string): number {
  const player = players.find((p) => p.id === playerId)
  return player ? boardSlotForColor(player.color) : 0
}
