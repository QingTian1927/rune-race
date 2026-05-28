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
      className={[
        'pointer-events-auto fixed bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-2xl border-2 bg-white/80 px-8 py-3 text-lg font-black uppercase tracking-wide text-gray-900 shadow-lg backdrop-blur-sm transition-all duration-150 hover:scale-105 active:scale-95',
        colorStyles.border,
      ].join(' ')}
    >
      🎲 TUNG XÚC XẮC
    </button>
  )
}
