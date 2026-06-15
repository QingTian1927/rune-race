import { useState } from 'react'
import type { Player } from '@rune-race/shared'
import { formatCoinAmount } from '@rune-race/shared'
import { HUD_PANEL_LABEL_CLASS, HUD_PLAYER_NAME_CLASS, PLAYER_COLOR_MAP } from './playerColorStyles'
import { PlayerBadge } from './PlayerBadge'
import { PanelCollapseButton } from './PanelCollapseButton'

type MyPlayerPanelProps = {
  player: Player | null
  avatarEmoji?: string | null
  sessionCoinTotal?: number | null
}

export function MyPlayerPanel({ player, avatarEmoji, sessionCoinTotal = null }: MyPlayerPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (!player) return null

  const colorStyles = PLAYER_COLOR_MAP[player.color]
  const showSessionCoins = sessionCoinTotal !== null
  const sessionCoinClass =
    sessionCoinTotal !== null && sessionCoinTotal < 0
      ? 'game-hud-session-coins game-hud-session-coins--loss'
      : 'game-hud-session-coins'

  if (collapsed) {
    return (
      <div className="game-hud-slot game-hud-slot--self">
        <div key="collapsed" className="game-hud-panel game-hud-panel--collapsed game-hud-panel--motion">
          <PanelCollapseButton
            collapsed={collapsed}
            expandDirection="left"
            onClick={() => setCollapsed(false)}
          />
          <PlayerBadge color={player.color} avatarEmoji={avatarEmoji} />
        </div>
      </div>
    )
  }

  return (
    <div className="game-hud-slot game-hud-slot--self">
      <div key="expanded" className={['game-hud-panel game-hud-panel--motion', colorStyles.hudPanel].join(' ')}>
        <div className="game-hud-row game-hud-row--reverse">
          <div className="game-hud-self-copy">
            <p className={HUD_PANEL_LABEL_CLASS}>BẠN</p>
            <p className={[HUD_PLAYER_NAME_CLASS, colorStyles.nameClass].join(' ')}>{player.name}</p>
            {showSessionCoins ? (
              <p className={sessionCoinClass}>
                Ván này:{' '}
                {sessionCoinTotal >= 0 ? '+' : ''}
                {formatCoinAmount(sessionCoinTotal)}
              </p>
            ) : null}
          </div>
          <PlayerBadge color={player.color} avatarEmoji={avatarEmoji} />
          <PanelCollapseButton
            collapsed={collapsed}
            expandDirection="left"
            onClick={() => setCollapsed(true)}
          />
        </div>
      </div>
    </div>
  )
}
