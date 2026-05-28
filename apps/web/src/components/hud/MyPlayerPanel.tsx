import { useState } from 'react'
import type { Player } from '@rune-race/shared'
import { PLAYER_COLOR_MAP } from './playerColorStyles'
import { PlayerBadge } from './PlayerBadge'
import { PanelCollapseButton } from './PanelCollapseButton'

type MyPlayerPanelProps = {
  player: Player | null
}

export function MyPlayerPanel({ player }: MyPlayerPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (!player) return null

  const colorStyles = PLAYER_COLOR_MAP[player.color]

  if (collapsed) {
    return (
      <div className="pointer-events-auto absolute bottom-6 right-4 z-10 flex items-center gap-2 rounded-xl border border-gray-200/80 bg-white/85 px-2.5 py-2 backdrop-blur-sm shadow-sm">
        <PanelCollapseButton
          collapsed={collapsed}
          expandDirection="left"
          onClick={() => setCollapsed(false)}
        />
        <PlayerBadge color={player.color} />
      </div>
    )
  }

  return (
    <div
      className={[
        'pointer-events-auto absolute bottom-6 right-4 z-10 rounded-xl border bg-stone-100/80 px-3 py-2 backdrop-blur-sm shadow-sm transition-all duration-200',
        colorStyles.border,
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-[128px] text-right">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">BẠN</p>
          <p className={['text-sm font-bold leading-tight', colorStyles.text].join(' ')}>{player.name}</p>
        </div>
        <PlayerBadge color={player.color} />
        <PanelCollapseButton
          collapsed={collapsed}
          expandDirection="left"
          onClick={() => setCollapsed(true)}
        />
      </div>
    </div>
  )
}
