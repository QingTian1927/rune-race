import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createRoom,
  fetchPublicRooms,
  getMatchmakingStatus,
  joinMatchmaking,
  leaveMatchmaking,
  resolveRoomByCode,
  updateDisplayName,
  type PublicRoom,
} from '../lib/api'
import { ensureOnlineSession } from '../lib/ensureOnlineSession'
import { getPlayerName, setPlayerName } from '../lib/playerSession'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useMyProfilePath, usePlayerIdentity } from '../hooks/usePlayerIdentity'
import {
  gameAlertError,
  gameBtnGhost,
  gameBtnGhostFull,
  gameBtnPrimary,
  gameContainerWide,
  gameIdentityInput,
  gameInput,
  gameListRow,
  gameMeta,
  gameNavLink,
  gameNavRow,
  gamePage,
  gamePanel,
  gamePanelStack,
  gameSectionTitle,
  gameTagline,
  gameTitle,
} from '../lib/gameUiStyles'

function PersonIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { signOut, isRegistered } = useAuth()
  const {
    playerId,
    playerName,
    avatarEmoji,
    accessToken,
    canEditNameOnHome,
  } = usePlayerIdentity()
  const profilePath = useMyProfilePath()
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

  const saveLocalName = () => setPlayerName(name)

  const saveAnonDisplayName = async () => {
    saveLocalName()
    if (!canEditNameOnHome || !accessToken) return
    try {
      await updateDisplayName(accessToken, name.trim())
      await supabase.auth.refreshSession()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save name')
    }
  }

  const prepareOnline = async () => {
    saveLocalName()
    const session = await ensureOnlineSession(name)
    return session
  }

  const handleCreateRoom = async () => {
    setError(null)
    setLoading(true)
    try {
      const session = await prepareOnline()
      const result = await createRoom(
        {
          playerId: session.playerId,
          playerName: session.playerName,
          name: roomName || undefined,
          password: createPassword || undefined,
        },
        session.accessToken,
      )
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
      await prepareOnline()
      const { lobbyId } = await resolveRoomByCode(joinCode.trim())
      navigate(`/lobby/${lobbyId}`, { state: { password: roomPassword || undefined } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Room not found')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinLobby = async (lobbyId: string) => {
    setError(null)
    setLoading(true)
    try {
      await prepareOnline()
      navigate(`/lobby/${lobbyId}`, { state: { password: roomPassword || undefined } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Join failed')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickMatch = async () => {
    setError(null)
    setMatchStatus('Đang tìm trận...')
    setLoading(true)
    try {
      const session = await prepareOnline()
      await joinMatchmaking(session.playerId, session.playerName, session.accessToken)
      const poll = async () => {
        const status = await getMatchmakingStatus(session.playerId)
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
    } finally {
      setLoading(false)
    }
  }

  const handleCancelMatch = async () => {
    await leaveMatchmaking(playerId)
    setMatchStatus(null)
  }

  return (
    <div className={gamePage}>
      <div className={gameContainerWide}>
        <nav className={gameNavRow}>
          {isRegistered ? (
            <>
              {profilePath ? (
                <Link to={profilePath} className={gameNavLink}>
                  Profile
                </Link>
              ) : null}
              <button type="button" onClick={signOut} className={gameNavLink}>
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/auth/login" className={gameNavLink}>
                Đăng nhập
              </Link>
              <Link to="/auth/signup" className={gameNavLink}>
                Đăng ký
              </Link>
            </>
          )}
        </nav>

        <header className="mb-6 text-center">
          <h1 className={gameTitle}>Rune Race</h1>
          <p className={`mt-1 ${gameTagline}`}>Cá ngựa online — chơi ẩn danh</p>
        </header>

        <div className="relative mb-6">
          {avatarEmoji ? (
            <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-base leading-none">
              {avatarEmoji}
            </span>
          ) : (
            <PersonIcon />
          )}
          {isRegistered ? (
            <div
              className={`${avatarEmoji ? `${gameIdentityInput} pl-9` : gameIdentityInput} flex items-center justify-between`}
            >
              <span className="truncate font-medium text-stone-800">{playerName}</span>
              <Link to="/profile/edit" className={`shrink-0 ${gameNavLink}`}>
                Sửa profile
              </Link>
            </div>
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                void saveAnonDisplayName()
              }}
              placeholder="Tên hiển thị"
              className={avatarEmoji ? `${gameIdentityInput} pl-9` : gameIdentityInput}
              maxLength={50}
              aria-label="Tên hiển thị"
            />
          )}
        </div>

        {error ? <div className={`mb-4 ${gameAlertError}`}>{error}</div> : null}

        <div className={gamePanelStack}>
          <section className={gamePanel}>
            <h2 className={gameSectionTitle}>Vào phòng</h2>
            <p className={`mt-1 ${gameMeta}`}>Mã 8 ký tự, phân biệt hoa thường</p>
            <div className="mt-3 space-y-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="joinCode"
                className={`font-mono ${gameInput}`}
                maxLength={8}
              />
              <input
                type="password"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                placeholder="Mật khẩu phòng (nếu có)"
                className={gameInput}
              />
            </div>
            <button
              type="button"
              disabled={loading || !joinCode.trim()}
              onClick={handleJoinCode}
              className={`mt-3 ${gameBtnGhostFull}`}
            >
              Vào bằng mã
            </button>
          </section>

          <section className={gamePanel}>
            <h2 className={gameSectionTitle}>Tạo phòng</h2>
            <div className="mt-3 space-y-2">
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Tên phòng"
                className={gameInput}
              />
              <input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Mật khẩu (tùy chọn)"
                className={gameInput}
              />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleCreateRoom}
              className={`mt-3 ${gameBtnPrimary}`}
            >
              Tạo phòng mới
            </button>
          </section>

          <section className={gamePanel}>
            <div className="flex items-center justify-between">
              <h2 className={gameSectionTitle}>Chơi ngay</h2>
              {matchStatus ? (
                <button type="button" onClick={handleCancelMatch} className={gameNavLink}>
                  Hủy
                </button>
              ) : null}
            </div>
            <p className={`mt-1 ${gameMeta}`}>
              Ghép 4 người sau 20s, 3 người sau 40s, 2 người sau 60s
            </p>
            {matchStatus ? (
              <p className="mt-3 text-sm font-semibold text-amber-800">{matchStatus}</p>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleQuickMatch}
                className={`mt-3 ${gameBtnPrimary}`}
              >
                Tìm trận
              </button>
            )}
          </section>

          <section className={gamePanel}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className={gameSectionTitle}>Phòng công khai</h2>
              <button type="button" onClick={refreshRooms} className={gameNavLink}>
                Làm mới
              </button>
            </div>
            {rooms.length === 0 ? (
              <p className={gameTagline}>Chưa có phòng nào</p>
            ) : (
              <ul className="space-y-2">
                {rooms.map((room) => (
                  <li key={room.lobbyId} className={gameListRow}>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-stone-800">{room.name}</div>
                      <div className={gameMeta}>
                        {room.playerCount}/{room.maxPlayers}
                        {room.hasPassword ? ' · có mật khẩu' : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void handleJoinLobby(room.lobbyId)}
                      className={`shrink-0 ${gameBtnGhost}`}
                    >
                      Vào
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="mt-8 text-center">
          <Link to="/play/local" className={gameNavLink}>
            Chế độ test local (không server)
          </Link>
        </div>
      </div>
    </div>
  )
}
