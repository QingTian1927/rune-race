import type { Player } from '@rune-race/shared'
import { gameSectionTitle } from '../../lib/gameUiStyles'
import { PlayerBadge } from './PlayerBadge'
import { HUD_PANEL_LABEL_CLASS, HUD_PLAYER_NAME_CLASS, PLAYER_COLOR_MAP } from './playerColorStyles'

type GameEndEntry = {
  player: Player
  rank: number
  isUnfinished: boolean
}

type GameEndOverlayProps = {
  open: boolean
  entries: GameEndEntry[]
  countdownSeconds: number
  returnDestinationLabel: string
  avatarsByPlayerId?: Record<string, string>
  onLeave: () => void
}

const leaveButtonClass =
  'rounded-xl border-2 border-red-300 bg-red-50/90 px-5 py-2 text-sm font-bold uppercase tracking-wider text-red-700 transition-all duration-150 hover:bg-red-100 active:scale-95'

export function GameEndOverlay({
  open,
  entries,
  countdownSeconds,
  returnDestinationLabel,
  avatarsByPlayerId = {},
  onLeave,
}: GameEndOverlayProps) {
  if (!open) return null

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" aria-hidden />
      <div className="relative w-full max-w-xl rounded-3xl border border-amber-200/80 bg-white/90 px-6 py-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-2xl shadow-sm">
            🏁
          </div>
          <div>
            <h2 className={`${gameSectionTitle} text-base`}>TỔNG KẾT VÁN ĐẤU</h2>
            <p className="text-sm text-stone-500">Thứ tự về đích của người chơi</p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/90 px-3 py-1 text-sm font-semibold text-amber-700 shadow-sm">
            <span className="tabular-nums">{countdownSeconds}s</span>
          </div>
        </div>

        <p className="mt-3 text-sm text-stone-600">
          Tự động trở về {returnDestinationLabel} sau{' '}
          <span className="font-semibold tabular-nums">{countdownSeconds}s</span>.
        </p>

        <div className="mt-4 space-y-2">
          {entries.map((entry) => {
            const colorStyles = PLAYER_COLOR_MAP[entry.player.color]
            return (
              <div
                key={entry.player.id}
                className="flex items-center gap-3 rounded-2xl border border-amber-200/70 bg-white/80 px-3 py-2"
              >
                <span className="w-6 text-sm font-semibold text-stone-500">{entry.rank}</span>
                <PlayerBadge
                  color={entry.player.color}
                  avatarEmoji={avatarsByPlayerId[entry.player.id]}
                  size="sm"
                />
                <div className="flex-1">
                  <p className={[HUD_PLAYER_NAME_CLASS, colorStyles.text].join(' ')}>
                    {entry.player.name}
                  </p>
                  {entry.isUnfinished ? (
                    <p className="text-xs text-stone-500">Chưa về đích</p>
                  ) : null}
                </div>
                {!entry.isUnfinished && entry.rank === 1 ? (
                  <span className="text-lg" aria-hidden>
                    🏆
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className={HUD_PANEL_LABEL_CLASS}>
            Ở lại để trở về {returnDestinationLabel}.
          </p>
          <button type="button" onClick={onLeave} className={leaveButtonClass}>
            Rời game
          </button>
        </div>
      </div>
    </div>
  )
}
