import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createRoom,
  fetchPublicRooms,
  getMatchmakingStatus,
  joinMatchmaking,
  leaveMatchmaking,
  resolveRoomByCode,
  type PublicRoom,
} from '../lib/api'
import { getPlayerName, setPlayerName } from '../lib/playerSession'
import { useAuth } from '../hooks/useAuth'
import { usePlayerIdentity } from '../hooks/usePlayerIdentity'

export default function HomePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { playerId, playerName } = usePlayerIdentity()
  const [name, setName] = useState(playerName || getPlayerName())
  const [joinCode, setJoinCode] = useState('')
  const [roomPassword, setRoomPassword] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [roomName, setRoomName] = useState('')
  const [rooms, setRooms] = useState<PublicRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchStatus, setMatchStatus] = useState<string | null>(null)

  useEffect(() => {
    if (playerName) setName(playerName)
  }, [playerName])

  const refreshRooms = useCallback(async () => {
    try {
      setRooms(await fetchPublicRooms())
    } catch {
      setRooms([])
    }
  }, [])

  useEffect(() => {
    refreshRooms()
    const interval = setInterval(refreshRooms, 5000)
    return () => clearInterval(interval)
  }, [refreshRooms])

  const saveName = () => setPlayerName(name)

  const handleCreateRoom = async () => {
    setError(null)
    setLoading(true)
    try {
      saveName()
      const result = await createRoom({
        playerId,
        playerName: name,
        name: roomName || undefined,
        password: createPassword || undefined,
      })
      navigate(`/lobby/${result.lobbyId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinCode = async () => {
    if (!joinCode.trim()) return
    setError(null)
    setLoading(true)
    try {
      saveName()
      const { lobbyId } = await resolveRoomByCode(joinCode.trim())
      navigate(`/lobby/${lobbyId}`, { state: { password: roomPassword || undefined } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Room not found')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinLobby = (lobbyId: string) => {
    saveName()
    navigate(`/lobby/${lobbyId}`, { state: { password: roomPassword || undefined } })
  }

  const handleQuickMatch = async () => {
    setError(null)
    setMatchStatus('Đang tìm trận...')
    try {
      saveName()
      await joinMatchmaking(playerId, name)
      const poll = async () => {
        const status = await getMatchmakingStatus(playerId)
        if (status.status === 'matched' && status.lobbyId) {
          setMatchStatus(null)
          navigate(`/lobby/${status.lobbyId}`)
          return
        }
        if (status.status === 'queued') {
          setMatchStatus(
            `Đang chờ... ${status.waitedSeconds}s (${status.queueSize} người trong hàng)`,
          )
          setTimeout(poll, 1500)
          return
        }
        setMatchStatus('Không tìm được trận')
      }
      await poll()
    } catch (e) {
      setMatchStatus(null)
      setError(e instanceof Error ? e.message : 'Matchmaking failed')
    }
  }

  const handleCancelMatch = async () => {
    await leaveMatchmaking(playerId)
    setMatchStatus(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Rune Race</h1>
          <p className="mt-2 text-slate-400">Cá ngựa online — chơi ẩn danh</p>
          <div className="mt-4 flex items-center justify-center gap-3 text-xs text-slate-400">
            {user ? (
              <>
                <span>Signed in: {user.email ?? user.id.slice(0, 8)}</span>
                <Link to="/profile/edit" className="underline">
                  Profile
                </Link>
                <button type="button" onClick={signOut} className="underline">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/auth/login" className="underline">
                  Login
                </Link>
                <Link to="/auth/signup" className="underline">
                  Sign up
                </Link>
                <Link to="/profile/edit" className="underline">
                  Profile
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="mb-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
          <label className="block text-sm font-medium text-slate-300">Tên hiển thị</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            maxLength={50}
          />
        </section>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
            <h2 className="text-lg font-semibold">Vào phòng</h2>
            <p className="mt-1 text-xs text-slate-400">Mã 8 ký tự, phân biệt hoa thường</p>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="joinCode"
              className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-sm"
              maxLength={8}
            />
            <input
              type="password"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              placeholder="Mật khẩu phòng (nếu có)"
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={loading || !joinCode.trim()}
              onClick={handleJoinCode}
              className="mt-3 w-full rounded-lg bg-cyan-600 py-2.5 font-semibold hover:bg-cyan-500 disabled:opacity-50"
            >
              Vào bằng mã
            </button>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
            <h2 className="text-lg font-semibold">Tạo phòng</h2>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Tên phòng"
              className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              placeholder="Mật khẩu (tùy chọn)"
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={loading}
              onClick={handleCreateRoom}
              className="mt-3 w-full rounded-lg bg-emerald-600 py-2.5 font-semibold hover:bg-emerald-500 disabled:opacity-50"
            >
              Tạo phòng mới
            </button>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Chơi ngay</h2>
            {matchStatus ? (
              <button
                type="button"
                onClick={handleCancelMatch}
                className="text-xs text-slate-400 underline hover:text-white"
              >
                Hủy
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Ghép 4 người sau 20s, 3 người sau 40s, 2 người sau 60s
          </p>
          {matchStatus ? (
            <p className="mt-3 text-sm text-amber-200">{matchStatus}</p>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleQuickMatch}
              className="mt-3 w-full rounded-lg bg-amber-500 py-2.5 font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
            >
              Tìm trận
            </button>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Phòng công khai</h2>
            <button
              type="button"
              onClick={refreshRooms}
              className="text-xs text-cyan-400 hover:underline"
            >
              Làm mới
            </button>
          </div>
          {rooms.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có phòng nào</p>
          ) : (
            <ul className="space-y-2">
              {rooms.map((room) => (
                <li
                  key={room.lobbyId}
                  className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2"
                >
                  <div>
                    <div className="font-medium">{room.name}</div>
                    <div className="text-xs text-slate-400">
                      {room.playerCount}/{room.maxPlayers}
                      {room.hasPassword ? ' · có mật khẩu' : ''} ·{' '}
                      <span className="font-mono">{room.joinCode}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJoinLobby(room.lobbyId)}
                    className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium hover:bg-slate-600"
                  >
                    Vào
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-8 text-center">
          <Link
            to="/play/local"
            className="text-sm text-slate-500 underline hover:text-slate-300"
          >
            Chế độ test local (không server)
          </Link>
        </div>
      </div>
    </div>
  )
}
