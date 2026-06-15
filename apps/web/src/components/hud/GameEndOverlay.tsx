import type { CoinBreakdown } from '@rune-race/shared'
import type { Player } from '@rune-race/shared'
import { formatCoinAmount } from '@rune-race/shared'
import { PlayerBadge } from './PlayerBadge'
import { HUD_PANEL_LABEL_CLASS, HUD_PLAYER_NAME_CLASS, PLAYER_COLOR_MAP } from './playerColorStyles'

type GameEndEntry = {
  player: Player
  rank: number
  isUnfinished: boolean
  coins?: CoinBreakdown | null
}

type GameEndOverlayProps = {
  open: boolean
  entries: GameEndEntry[]
  countdownSeconds: number
  returnDestinationLabel: string
  avatarsByPlayerId?: Record<string, string>
  localPlayerId?: string
  onLeave: () => void
}

function coinClassName(amount: number): string {
  if (amount > 0) return 'game-hud-coin-amount game-hud-coin-amount--gain'
  if (amount < 0) return 'game-hud-coin-amount game-hud-coin-amount--loss'
  return 'game-hud-coin-amount'
}

export function GameEndOverlay({
  open,
  entries,
  countdownSeconds,
  returnDestinationLabel,
  avatarsByPlayerId = {},
  localPlayerId,
  onLeave,
}: GameEndOverlayProps) {
  if (!open) return null

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="game-hud-backdrop" aria-hidden />
      <div className="game-hud-modal">
        <div className="game-hud-modal-head">
          <div className="game-hud-modal-icon" aria-hidden>
            🏁
          </div>
          <div>
            <h2 className="game-hud-modal-title">TỔNG KẾT VÁN ĐẤU</h2>
            <p className="game-hud-modal-subtitle">Thứ tự về đích và xu nhận được</p>
          </div>
          <div className="game-hud-countdown">
            <span className="tabular-nums">{countdownSeconds}s</span>
          </div>
        </div>

        <p className="game-hud-modal-body">
          Tự động trở về {returnDestinationLabel} sau{' '}
          <strong className="tabular-nums">{countdownSeconds}s</strong>.
        </p>

        <div className="game-hud-finish-list" style={{ marginTop: '14px' }}>
          {entries.map((entry) => {
            const colorStyles = PLAYER_COLOR_MAP[entry.player.color]
            const isLocal = localPlayerId === entry.player.id
            const coins = entry.coins
            return (
              <div
                key={entry.player.id}
                className={['game-hud-finish-item', isLocal ? 'game-hud-finish-item--local' : ''].join(' ')}
              >
                <span className="game-hud-finish-rank">{entry.rank}</span>
                <PlayerBadge
                  color={entry.player.color}
                  avatarEmoji={avatarsByPlayerId[entry.player.id]}
                  size="sm"
                />
                <div style={{ flex: 1 }}>
                  <p className={[HUD_PLAYER_NAME_CLASS, colorStyles.nameClass].join(' ')}>
                    {entry.player.name}
                    {isLocal ? ' (Bạn)' : ''}
                  </p>
                  {entry.isUnfinished ? (
                    <p className="game-hud-modal-subtitle">Chưa về đích</p>
                  ) : null}
                  {coins ? (
                    <p className="game-hud-coin-breakdown">
                      <span className={coinClassName(coins.total)}>
                        {coins.total >= 0 ? '+' : ''}
                        {formatCoinAmount(coins.total)}
                      </span>
                      <span className="game-hud-coin-breakdown-detail">
                        đá {coins.capture >= 0 ? '+' : ''}
                        {formatCoinAmount(coins.capture)} · ván {formatCoinAmount(coins.finish)}
                      </span>
                    </p>
                  ) : null}
                </div>
                {!entry.isUnfinished && entry.rank === 1 ? (
                  <span className="game-hud-finish-trophy" aria-hidden>
                    🏆
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="game-hud-modal-actions">
          <p className={HUD_PANEL_LABEL_CLASS} style={{ marginRight: 'auto' }}>
            Ở lại để trở về {returnDestinationLabel}.
          </p>
          <button type="button" onClick={onLeave} className="btn-leave">
            Rời game
          </button>
        </div>
      </div>
    </div>
  )
}
