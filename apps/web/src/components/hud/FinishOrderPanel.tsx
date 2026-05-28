import { useState } from 'react'
import type { Player } from '@rune-race/shared'
import { PLAYER_COLOR_MAP } from './playerColorStyles'
import { PlayerBadge } from './PlayerBadge'

type FinishOrderPanelProps = {
  players: Player[]
}

export function FinishOrderPanel({ players }: FinishOrderPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (players.length === 0) return null

  if (collapsed) {
    return (
      <div className="pointer-events-auto absolute right-4 top-4 z-10 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 backdrop-blur-sm shadow-sm transition-all duration-200">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-white/80 px-2 py-1 text-xs font-semibold text-gray-700">
            🏆 {players.length}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="rounded-lg border border-amber-200/80 bg-white/80 px-2 py-1 text-[11px] font-semibold text-gray-600 transition-all hover:bg-white"
          >
            Mở
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-10 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 backdrop-blur-sm shadow-sm transition-all duration-200">
      <div className="mb-1.5 flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-400">VỀ ĐÍCH</p>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="ml-auto rounded-lg border border-amber-200/80 bg-white/80 px-2 py-1 text-[11px] font-semibold text-gray-600 transition-all hover:bg-white"
        >
          Thu
        </button>
      </div>
      <div className="space-y-1.5">
        {players.map((player, index) => (
          <div
            key={player.id}
            className="flex items-center gap-2 rounded-lg border border-amber-200/70 bg-white/75 px-3 py-2"
          >
            <span className="w-5 text-xs font-semibold text-gray-500">{index + 1}</span>
            <PlayerBadge color={player.color} />
            <span className={['text-sm font-bold', PLAYER_COLOR_MAP[player.color].text].join(' ')}>
              {player.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
