import { useState } from 'react'
import type { Player } from '@rune-race/shared'
import { HUD_PANEL_LABEL_CLASS, HUD_PLAYER_NAME_CLASS, PLAYER_COLOR_MAP } from './playerColorStyles'
import { PlayerBadge } from './PlayerBadge'
import { PanelCollapseButton } from './PanelCollapseButton'

type FinishOrderPanelProps = {
  players: Player[]
  avatarsByPlayerId?: Record<string, string>
}

export function FinishOrderPanel({ players, avatarsByPlayerId = {} }: FinishOrderPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (players.length === 0) return null

  if (collapsed) {
    return (
      <div className="game-hud-slot game-hud-slot--finish">
        <div className="game-hud-panel game-hud-panel--collapsed hud-p-gold">
          <span className="game-hud-finish-trophy" aria-hidden>
            🏆
          </span>
          <span className="game-hud-finish-count">{players.length}</span>
          <PanelCollapseButton
            collapsed={collapsed}
            expandDirection="down"
            onClick={() => setCollapsed(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="game-hud-slot game-hud-slot--finish">
      <div className="game-hud-panel hud-p-gold">
        <div className="game-hud-row game-hud-finish-head">
          <p className={HUD_PANEL_LABEL_CLASS}>VỀ ĐÍCH</p>
          <PanelCollapseButton
            collapsed={collapsed}
            expandDirection="down"
            onClick={() => setCollapsed(true)}
            className="game-hud-collapse-end"
          />
        </div>
        <div className="game-hud-finish-list">
          {players.map((player, index) => {
            const colorStyles = PLAYER_COLOR_MAP[player.color]
            return (
              <div key={player.id} className="game-hud-finish-item">
                <span className="game-hud-finish-rank">{index + 1}</span>
                <PlayerBadge
                  color={player.color}
                  avatarEmoji={avatarsByPlayerId[player.id]}
                  size="sm"
                />
                <span className={[HUD_PLAYER_NAME_CLASS, colorStyles.nameClass].join(' ')}>
                  {player.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
