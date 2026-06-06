import type { PlayerColor } from '@rune-race/shared'
import { PLAYER_COLOR_MAP } from './playerColorStyles'

type RollDiceButtonProps = {
  visible: boolean
  color: PlayerColor
  onClick: () => void
}

export function RollDiceButton({ visible, color, onClick }: RollDiceButtonProps) {
  const colorStyles = PLAYER_COLOR_MAP[color]

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={onClick}
      className={['game-btn game-hud-roll-btn', colorStyles.rollBtn].join(' ')}
    >
      <span className="game-hud-roll-icon" aria-hidden>
        🎲
      </span>
      <span>TUNG XÚC XẮC</span>
    </button>
  )
}
