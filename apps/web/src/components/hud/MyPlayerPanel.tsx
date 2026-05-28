import { useState } from 'react'
import type { Player } from '@rune-race/shared'
import { HUD_PANEL_LABEL_CLASS, HUD_PLAYER_NAME_CLASS, PLAYER_COLOR_MAP } from './playerColorStyles'
import { PlayerBadge } from './PlayerBadge'
import { PanelCollapseButton } from './PanelCollapseButton'

type MyPlayerPanelProps = {
  player: Player | null
  avatarEmoji?: string | null
}

export function MyPlayerPanel({ player, avatarEmoji }: MyPlayerPanelProps) {
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
        <PlayerBadge color={player.color} avatarEmoji={avatarEmoji} />
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
        <div className="min-w-[140px] text-right">
          <p className={HUD_PANEL_LABEL_CLASS}>BẠN</p>
          <p className={[HUD_PLAYER_NAME_CLASS, colorStyles.text].join(' ')}>{player.name}</p>
        </div>
        <PlayerBadge color={player.color} avatarEmoji={avatarEmoji} />
        <PanelCollapseButton
          collapsed={collapsed}
          expandDirection="left"
          onClick={() => setCollapsed(true)}
        />
      </div>
    </div>
  )
}
