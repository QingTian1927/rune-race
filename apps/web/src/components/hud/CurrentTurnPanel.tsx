import { useState } from 'react'
import type { Player } from '@rune-race/shared'
import { HUD_PANEL_LABEL_CLASS, HUD_PLAYER_NAME_CLASS, PLAYER_COLOR_MAP } from './playerColorStyles'
import { PlayerBadge } from './PlayerBadge'
import { PanelCollapseButton } from './PanelCollapseButton'

type CurrentTurnPanelProps = {
  player: Player | null
  isLocalTurn: boolean
  avatarEmoji?: string | null
}

export function CurrentTurnPanel({ player, isLocalTurn, avatarEmoji }: CurrentTurnPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (!player) return null

  const colorStyles = PLAYER_COLOR_MAP[player.color]

  if (collapsed) {
    return (
      <div className="pointer-events-auto absolute left-4 top-14 z-10 flex items-center gap-2 rounded-xl border border-gray-200/80 bg-white/85 px-2.5 py-2 backdrop-blur-sm shadow-sm">
        <PlayerBadge color={player.color} avatarEmoji={avatarEmoji} isActive={isLocalTurn} />
        <PanelCollapseButton
          collapsed={collapsed}
          expandDirection="right"
          onClick={() => setCollapsed(false)}
        />
      </div>
    )
  }

  return (
    <div
      className={[
        'pointer-events-auto absolute left-4 top-14 z-10 rounded-xl border bg-white/75 px-3 py-2 backdrop-blur-sm shadow-sm transition-all duration-200',
        colorStyles.border,
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <PlayerBadge color={player.color} avatarEmoji={avatarEmoji} isActive={isLocalTurn} />
        <div className="min-w-[172px]">
          <p className={HUD_PANEL_LABEL_CLASS}>LƯỢT HIỆN TẠI</p>
          <p className={[HUD_PLAYER_NAME_CLASS, colorStyles.text].join(' ')}>{player.name}</p>
        </div>
        <PanelCollapseButton
          collapsed={collapsed}
          expandDirection="right"
          onClick={() => setCollapsed(true)}
          className="ml-auto"
        />
      </div>
    </div>
  )
}
