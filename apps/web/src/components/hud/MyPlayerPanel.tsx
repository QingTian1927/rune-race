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
        'pointer-events-auto absolute bottom-6 right-4 z-10 rounded-2xl border-2 bg-stone-100/75 p-3 backdrop-blur-sm shadow-lg transition-all duration-200',
        colorStyles.border,
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        {!collapsed ? (
          <div className="min-w-[140px] text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">BẠN</p>
            <p className={['text-base font-black', colorStyles.text].join(' ')}>{player.name}</p>
          </div>
        ) : null}
        <PlayerBadge color={player.color} />
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="rounded-full border border-amber-200 bg-white/80 px-2 py-1 text-xs font-semibold text-gray-700 transition-all hover:bg-white"
        >
          {collapsed ? '<' : '>'}
        </button>
      </div>
    </div>
  )
}
