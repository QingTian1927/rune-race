import { useState } from 'react'
import type { Player } from '@rune-race/shared'
import { PLAYER_COLOR_MAP } from './playerColorStyles'
import { PlayerBadge } from './PlayerBadge'

type CurrentTurnPanelProps = {
  player: Player | null
  isLocalTurn: boolean
}

export function CurrentTurnPanel({ player, isLocalTurn }: CurrentTurnPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (!player) return null

  const colorStyles = PLAYER_COLOR_MAP[player.color]

  return (
    <div
      className={[
        'pointer-events-auto absolute left-4 top-14 z-10 rounded-2xl border bg-white/70 p-3 backdrop-blur-sm shadow-lg transition-all duration-200',
        colorStyles.border,
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <PlayerBadge color={player.color} isActive={isLocalTurn} />
        {!collapsed ? (
          <div className="min-w-[180px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
              LƯỢT HIỆN TẠI
            </p>
            <p className={['text-base font-black', colorStyles.text].join(' ')}>{player.name}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="ml-auto rounded-full border border-amber-200 bg-white/80 px-2 py-1 text-xs font-semibold text-gray-700 transition-all hover:bg-white"
        >
          {collapsed ? '>' : 'v'}
        </button>
      </div>
    </div>
  )
}
