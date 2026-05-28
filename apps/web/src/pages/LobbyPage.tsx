import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PLAYER_COLORS, type PlayerColor } from '@rune-race/shared'
import { PlayerBadge } from '../components/hud/PlayerBadge'
import { useLobbySocket } from '../hooks/useLobbySocket'
import { usePlayerIdentity } from '../hooks/usePlayerIdentity'
import { getSocket } from '../lib/socket'
import {
  gameAlertError,
  gameBtnDestructive,
  gameBtnGhost,
  gameBtnGhostFull,
  gameBtnPrimary,
  gameContainerWide,
  gameEmptySlot,
  gameInput,
  gameLabel,
  gameListRow,
  gameMeta,
  gameNavLink,
  gamePage,
  gamePanel,
  gameRoomCodeBadge,
  gameSectionTitle,
  gameTagline,
  gameTitle,
} from '../lib/gameUiStyles'

const COLOR_PICKER: Record<PlayerColor, string> = {
  red: 'bg-red-600 ring-red-400',
  blue: 'bg-blue-600 ring-blue-400',
  green: 'bg-green-600 ring-green-400',
  yellow: 'bg-yellow-500 ring-yellow-400',
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export default function LobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const password = (location.state as { password?: string } | null)?.password
  const [copied, setCopied] = useState(false)

  const { playerId, playerName, accessToken } = usePlayerIdentity()

  const {
    snapshot,
    error,
    connected,
    setColor,
    setReady,
    leave,
    kick,
    cancelCountdown,
    updateSettings,
    transferHost,
  } = useLobbySocket(lobbyId ?? '', playerId, playerName, password, accessToken)

  useEffect(() => {
    if (!lobbyId) return
    const socket = getSocket(accessToken)

    const onGameStarted = (payload: { gameId: string; lobbyId: string }) => {
      sessionStorage.setItem('rune-race-lobby-id', payload.lobbyId)
      navigate(`/game/${payload.gameId}`)
    }

    socket.on('lobby:game_started', onGameStarted)
    return () => {
      socket.off('lobby:game_started', onGameStarted)
    }
  }, [accessToken, lobbyId, navigate])

  useEffect(() => {
    if (snapshot?.status === 'in_game' && snapshot.currentGameId) {
      sessionStorage.setItem('rune-race-lobby-id', snapshot.lobbyId)
      navigate(`/game/${snapshot.currentGameId}`)
    }
  }, [snapshot?.status, snapshot?.currentGameId, snapshot?.lobbyId, navigate])

  const copyJoinCode = async () => {
    if (!snapshot?.joinCode) return
    try {
      await navigator.clipboard.writeText(snapshot.joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  if (!lobbyId) {
    return (
      <div className={`${gamePage} p-8`}>
        <p className={gameTagline}>Invalid lobby</p>
      </div>
    )
  }

  const me = snapshot?.players.find((p) => p.id === playerId)
  const isHost = me?.isHost ?? false
  const maxPlayers = snapshot?.settings.maxPlayers ?? 4
  const players = snapshot?.players ?? []
  const emptySlotCount = Math.max(0, maxPlayers - players.length)

  const handleLeave = () => {
    leave()
    navigate('/')
  }

  return (
    <div className={gamePage}>
      <div className={gameContainerWide}>
        <Link to="/" className={gameNavLink}>
          ← Trang chủ
        </Link>

        <header className="mt-4">
          <h1 className={gameTitle}>{snapshot?.settings.name ?? 'Lobby'}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={gameRoomCodeBadge}>{snapshot?.joinCode ?? '...'}</span>
            <button
              type="button"
              onClick={copyJoinCode}
              className={`${gameBtnGhost} px-3 py-1.5`}
              aria-label="Sao chép mã phòng"
              title={copied ? 'Đã sao chép' : 'Sao chép'}
            >
              <span className="flex items-center gap-1.5">
                <CopyIcon />
                {copied ? 'Đã copy' : 'Copy'}
              </span>
            </button>
          </div>
          <p className={`mt-2 ${gameMeta}`}>
            {connected ? 'Đã kết nối' : 'Đang kết nối...'}
            {snapshot?.status === 'countdown' && snapshot.countdownSeconds !== null
              ? ` · Bắt đầu sau ${snapshot.countdownSeconds}s`
              : ''}
          </p>
        </header>

        {error ? <div className={`mt-4 ${gameAlertError}`}>{error}</div> : null}

        <section className={`mt-6 ${gamePanel}`}>
          <h2 className={`mb-3 ${gameSectionTitle}`}>Người chơi</h2>
          <ul className="space-y-2">
            {players.map((player) => (
              <li key={player.id} className={gameListRow}>
                <div className="flex min-w-0 items-center gap-3">
                  {player.color ? (
                    <PlayerBadge color={player.color} />
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-full border-2 border-dashed border-stone-300 bg-white/40" />
                  )}
                  <div className="min-w-0">
                    <Link
                      to={`/profile/${player.id}`}
                      className="truncate text-sm font-bold text-stone-800 hover:underline"
                    >
                      {player.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      {player.isHost ? (
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">
                          Host
                        </span>
                      ) : null}
                      {!player.connected ? (
                        <span className={gameMeta}>Offline</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {player.ready ? (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
                      Sẵn sàng
                    </span>
                  ) : (
                    <span className={gameMeta}>Chờ...</span>
                  )}
                  {isHost && player.id !== playerId && snapshot?.status === 'lobby' ? (
                    <button
                      type="button"
                      onClick={() => kick(player.id)}
                      className={gameBtnDestructive}
                    >
                      Kick
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
            {Array.from({ length: emptySlotCount }, (_, i) => (
              <li key={`empty-${i}`} className={gameEmptySlot}>
                <div className="h-9 w-9 shrink-0 rounded-full border-2 border-dashed border-stone-300/80" />
                <span>Chỗ trống</span>
              </li>
            ))}
          </ul>
        </section>

        {snapshot?.status === 'lobby' || snapshot?.status === 'countdown' ? (
          <>
            <section className={`mt-4 ${gamePanel}`}>
              <h2 className={`mb-3 ${gameSectionTitle}`}>Chọn màu</h2>
              <div className="flex flex-wrap gap-3">
                {PLAYER_COLORS.map((color) => {
                  const taken = snapshot?.takenColors.includes(color)
                  const selected = me?.color === color
                  return (
                    <button
                      key={color}
                      type="button"
                      disabled={taken && !selected}
                      onClick={() => setColor(color)}
                      className={`h-12 w-12 rounded-full ring-2 ring-offset-1 ring-offset-amber-50 ${COLOR_PICKER[color]} ${
                        selected ? 'ring-stone-700' : 'ring-transparent opacity-80'
                      } disabled:cursor-not-allowed disabled:opacity-30`}
                      title={color}
                    />
                  )
                })}
              </div>
            </section>

            {isHost ? (
              <HostPanel
                onUpdateSettings={updateSettings}
                onTransferHost={transferHost}
                players={players}
                currentName={snapshot?.settings.name ?? ''}
              />
            ) : null}

            <div className="mt-6 space-y-2">
              <button
                type="button"
                disabled={!me?.color}
                onClick={() => setReady(!me?.ready)}
                className={gameBtnPrimary}
              >
                {me?.ready ? 'Hủy sẵn sàng' : 'Sẵn sàng'}
              </button>

              {isHost && snapshot?.status === 'countdown' ? (
                <button type="button" onClick={cancelCountdown} className={gameBtnPrimary}>
                  Hủy đếm ngược
                </button>
              ) : null}

              <button type="button" onClick={handleLeave} className={gameBtnGhostFull}>
                Rời phòng
              </button>
            </div>
          </>
        ) : (
          <p className={`mt-6 text-center ${gameTagline}`}>Đang chuyển vào game...</p>
        )}
      </div>
    </div>
  )
}

function HostPanel({
  onUpdateSettings,
  onTransferHost,
  players,
  currentName,
}: {
  onUpdateSettings: (p: { name?: string; password?: string; clearPassword?: boolean }) => void
  onTransferHost: (id: string) => void
  players: Array<{ id: string; name: string; isHost: boolean }>
  currentName: string
}) {
  return (
    <section className={`mt-4 ${gamePanel}`}>
      <h2 className={gameSectionTitle}>Cài đặt host</h2>
      <div className="mt-3 space-y-2">
        <div>
          <label htmlFor="host-room-name" className={gameLabel}>
            Tên phòng
          </label>
          <input
            id="host-room-name"
            defaultValue={currentName}
            className={`mt-1.5 ${gameInput}`}
            onBlur={(e) => {
              if (e.target.value.trim()) onUpdateSettings({ name: e.target.value.trim() })
            }}
          />
        </div>
        <div>
          <label htmlFor="host-room-password" className={gameLabel}>
            Mật khẩu mới
          </label>
          <input
            id="host-room-password"
            type="password"
            placeholder="Để trống nếu không đổi"
            className={`mt-1.5 ${gameInput}`}
            onBlur={(e) => {
              if (e.target.value) onUpdateSettings({ password: e.target.value })
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => onUpdateSettings({ clearPassword: true })}
          className="text-sm text-stone-500 underline hover:text-stone-800"
        >
          Xóa mật khẩu
        </button>
      </div>
      <div className="mt-4">
        <label className={gameLabel} htmlFor="host-transfer">
          Chuyển host
        </label>
        <select
          id="host-transfer"
          className={`mt-1.5 ${gameInput}`}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onTransferHost(e.target.value)
          }}
        >
          <option value="">Chọn người chơi</option>
          {players
            .filter((p) => !p.isHost)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </div>
    </section>
  )
}
