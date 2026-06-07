import type { PlayerColor } from '@rune-race/shared'
import { PLAYER_COLOR_MAP } from './playerColorStyles'
import { usePresenceTransition } from './usePresenceTransition'

type RollDiceButtonProps = {
  visible: boolean
  color: PlayerColor
  onClick: () => void
}

export function RollDiceButton({ visible, color, onClick }: RollDiceButtonProps) {
  const colorStyles = PLAYER_COLOR_MAP[color]
  const { render, motionClass } = usePresenceTransition(visible, { enterMs: 240, exitMs: 130 })

  if (!render) return null

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'game-btn game-hud-roll-btn game-hud-presence',
        motionClass,
        colorStyles.rollBtn,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="game-hud-roll-icon" aria-hidden>
        🎲
      </span>
      <span>TUNG XÚC XẮC</span>
    </button>
  )
}
