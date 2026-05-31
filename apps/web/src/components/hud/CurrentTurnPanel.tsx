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
      <div className="game-hud-slot game-hud-slot--turn">
        <div className="game-hud-panel game-hud-panel--collapsed">
          <PlayerBadge color={player.color} avatarEmoji={avatarEmoji} isActive={isLocalTurn} />
          <PanelCollapseButton
            collapsed={collapsed}
            expandDirection="right"
            onClick={() => setCollapsed(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="game-hud-slot game-hud-slot--turn">
      <div className={['game-hud-panel', colorStyles.hudPanel].join(' ')}>
        <div className="game-hud-row">
          <PlayerBadge color={player.color} avatarEmoji={avatarEmoji} isActive={isLocalTurn} />
          <div className="game-hud-turn-copy">
            <p className={HUD_PANEL_LABEL_CLASS}>LƯỢT HIỆN TẠI</p>
            <p className={[HUD_PLAYER_NAME_CLASS, colorStyles.nameClass].join(' ')}>{player.name}</p>
          </div>
          <PanelCollapseButton
            collapsed={collapsed}
            expandDirection="right"
            onClick={() => setCollapsed(true)}
            className="game-hud-collapse-end"
          />
        </div>
      </div>
    </div>
  )
}
