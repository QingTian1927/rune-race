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
      <div className="pointer-events-auto absolute right-4 top-4 z-10 rounded-2xl border border-amber-200 bg-amber-50/80 p-2 backdrop-blur-sm shadow-md transition-all duration-200">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/80 px-2 py-1 text-sm text-gray-700">🏆 {players.length}</span>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="rounded-full border border-amber-200 bg-white/80 px-2 py-1 text-xs font-semibold text-gray-700 transition-all hover:bg-white"
          >
            &gt;
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-10 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 backdrop-blur-sm shadow-md transition-all duration-200">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-sm font-black uppercase tracking-wide text-gray-900">VỀ ĐÍCH</p>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="ml-auto rounded-full border border-amber-200 bg-white/80 px-2 py-1 text-xs font-semibold text-gray-700 transition-all hover:bg-white"
        >
          v
        </button>
      </div>
      <div className="space-y-2">
        {players.map((player, index) => (
          <div
            key={player.id}
            className="flex items-center gap-2 rounded-xl border border-amber-200/80 bg-white/70 px-3 py-2"
          >
            <span className="w-6 text-sm font-black text-gray-700">{index + 1}</span>
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
