import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PLAYER_COLORS, type PlayerColor } from '@rune-race/shared'
import { useLobbySocket } from '../hooks/useLobbySocket'
import { usePlayerIdentity } from '../hooks/usePlayerIdentity'
import { getSocket } from '../lib/socket'

const COLOR_STYLES: Record<PlayerColor, string> = {
  red: 'bg-red-600 ring-red-300',
  blue: 'bg-blue-600 ring-blue-300',
  green: 'bg-green-600 ring-green-300',
  yellow: 'bg-yellow-500 ring-yellow-300 text-slate-900',
}

export default function LobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const password = (location.state as { password?: string } | null)?.password

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

  if (!lobbyId) {
    return <div className="p-8 text-white">Invalid lobby</div>
  }

  const me = snapshot?.players.find((p) => p.id === playerId)
  const isHost = me?.isHost ?? false

  const handleLeave = () => {
    leave()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-lg px-6 py-10">
        <Link to="/" className="text-sm text-slate-400 hover:text-white">
          ← Trang chủ
        </Link>

        <header className="mt-4">
          <h1 className="text-2xl font-bold">{snapshot?.settings.name ?? 'Lobby'}</h1>
          <p className="mt-1 font-mono text-sm text-cyan-400">
            Mã phòng: {snapshot?.joinCode ?? '...'}
          </p>
          <p className="text-xs text-slate-500">
            {connected ? 'Đã kết nối' : 'Đang kết nối...'}
            {snapshot?.status === 'countdown' && snapshot.countdownSeconds !== null
              ? ` · Bắt đầu sau ${snapshot.countdownSeconds}s`
              : ''}
          </p>
        </header>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Người chơi</h2>
          <ul className="space-y-2">
            {(snapshot?.players ?? []).map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2"
              >
                <div>
                  <Link to={`/profile/${player.id}`} className="font-medium hover:underline">
                    {player.name}
                  </Link>
                  {player.isHost ? (
                    <span className="ml-2 text-xs text-amber-400">Host</span>
                  ) : null}
                  {!player.connected ? (
                    <span className="ml-2 text-xs text-slate-500">Offline</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {player.color ? (
                    <span
                      className={`h-4 w-4 rounded-full ${COLOR_STYLES[player.color].split(' ')[0]}`}
                    />
                  ) : (
                    <span className="text-xs text-slate-500">Chưa chọn màu</span>
                  )}
                  {player.ready ? (
                    <span className="text-xs text-emerald-400">Ready</span>
                  ) : null}
                  {isHost && player.id !== playerId && snapshot?.status === 'lobby' ? (
                    <button
                      type="button"
                      onClick={() => kick(player.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Kick
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {snapshot?.status === 'lobby' || snapshot?.status === 'countdown' ? (
          <>
            <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Chọn màu</h2>
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
                      className={`h-12 w-12 rounded-full ring-2 ring-offset-2 ring-offset-slate-900 ${COLOR_STYLES[color]} ${
                        selected ? 'ring-white' : 'ring-transparent opacity-80'
                      } disabled:cursor-not-allowed disabled:opacity-30`}
                      title={color}
                    />
                  )
                })}
              </div>
            </section>

            <section className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={!me?.color}
                onClick={() => setReady(!me?.ready)}
                className="flex-1 rounded-lg bg-emerald-600 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-40"
              >
                {me?.ready ? 'Hủy ready' : 'Sẵn sàng'}
              </button>
              <button
                type="button"
                onClick={handleLeave}
                className="rounded-lg border border-slate-600 px-4 py-3 text-sm hover:bg-slate-800"
              >
                Rời phòng
              </button>
            </section>

            {isHost && snapshot?.status === 'countdown' ? (
              <button
                type="button"
                onClick={cancelCountdown}
                className="mt-4 w-full rounded-lg border border-amber-500/50 py-2 text-sm text-amber-200 hover:bg-amber-950/40"
              >
                Hủy đếm ngược (host)
              </button>
            ) : null}

            {isHost ? (
              <HostPanel
                onUpdateSettings={updateSettings}
                onTransferHost={transferHost}
                players={snapshot?.players ?? []}
                currentName={snapshot?.settings.name ?? ''}
              />
            ) : null}
          </>
        ) : (
          <p className="mt-6 text-center text-slate-400">Đang chuyển vào game...</p>
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
    <section className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5">
      <h2 className="text-sm font-semibold text-amber-200">Host</h2>
      <div className="mt-3 space-y-2">
        <input
          id="host-room-name"
          defaultValue={currentName}
          placeholder="Tên phòng"
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
          onBlur={(e) => {
            if (e.target.value.trim()) onUpdateSettings({ name: e.target.value.trim() })
          }}
        />
        <input
          id="host-room-password"
          type="password"
          placeholder="Mật khẩu mới"
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
          onBlur={(e) => {
            if (e.target.value) onUpdateSettings({ password: e.target.value })
          }}
        />
        <button
          type="button"
          onClick={() => onUpdateSettings({ clearPassword: true })}
          className="text-xs text-slate-400 underline"
        >
          Xóa mật khẩu
        </button>
      </div>
      <div className="mt-4">
        <label className="text-xs text-slate-400" htmlFor="host-transfer">
          Chuyển host
        </label>
        <select
          id="host-transfer"
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
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
