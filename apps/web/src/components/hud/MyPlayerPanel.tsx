import { useState } from 'react'
import type { Player } from '@rune-race/shared'
import { PLAYER_COLOR_MAP } from './playerColorStyles'
import { PlayerBadge } from './PlayerBadge'

type MyPlayerPanelProps = {
  player: Player | null
}

export function MyPlayerPanel({ player }: MyPlayerPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (!player) return null

  const colorStyles = PLAYER_COLOR_MAP[player.color]

  return (
    <div
      className={[
        'pointer-events-auto absolute bottom-6 right-4 z-10 rounded-xl border bg-stone-100/80 px-3 py-2 backdrop-blur-sm shadow-sm transition-all duration-200',
        colorStyles.border,
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        {!collapsed ? (
          <div className="min-w-[128px] text-right">
            <p className="text-[10px] uppercase tracking-wider text-gray-400">BẠN</p>
            <p className={['text-sm font-bold leading-tight', colorStyles.text].join(' ')}>{player.name}</p>
          </div>
        ) : null}
        <PlayerBadge color={player.color} />
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="rounded-lg border border-amber-200/80 bg-white/80 px-2 py-1 text-[11px] font-semibold text-gray-600 transition-all hover:bg-white"
        >
          {collapsed ? 'Mở' : 'Thu'}
        </button>
      </div>
    </div>
  )
}
