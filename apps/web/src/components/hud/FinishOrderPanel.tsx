import { useState } from 'react'
import type { Player } from '@rune-race/shared'
import { PLAYER_COLOR_MAP } from './playerColorStyles'
import { PlayerBadge } from './PlayerBadge'
import { PanelCollapseButton } from './PanelCollapseButton'

type FinishOrderPanelProps = {
  players: Player[]
}

export function FinishOrderPanel({ players }: FinishOrderPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (players.length === 0) return null

  if (collapsed) {
    return (
      <div className="pointer-events-auto absolute right-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-gray-200/80 bg-white/85 px-2.5 py-2 backdrop-blur-sm shadow-sm">
        <span className="text-sm leading-none text-gray-600" aria-hidden>
          🏆
        </span>
        <span className="text-sm font-semibold tabular-nums text-gray-600">{players.length}</span>
        <PanelCollapseButton
          collapsed={collapsed}
          expandDirection="down"
          onClick={() => setCollapsed(false)}
        />
      </div>
    )
  }

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-10 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 backdrop-blur-sm shadow-sm transition-all duration-200">
      <div className="mb-1.5 flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-400">VỀ ĐÍCH</p>
        <PanelCollapseButton
          collapsed={collapsed}
          expandDirection="down"
          onClick={() => setCollapsed(true)}
          className="ml-auto"
        />
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
