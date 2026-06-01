import { useCallback, useEffect, useRef, useState } from 'react'
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
import { useAuth } from '../hooks/useAuth'
import { usePlayerIdentity } from '../hooks/usePlayerIdentity'
import { ensureOnlineSession } from '../lib/ensureOnlineSession'
import { getPlayerName, setPlayerName } from '../lib/playerSession'
import { PublicRoomCard } from '../components/sky/PublicRoomCard'
import { SkyPageLayout } from '../components/sky/SkyPageLayout'

type HomeView = 'menu' | 'form'
type HomeForm = 'join' | 'create' | 'match' | 'public'

type MatchSearchSession = {
  playerId: string
  playerName: string
  accessToken: string | null
}

export default function HomePage() {
  const navigate = useNavigate()
  const { playerName } = usePlayerIdentity()
  const { isRegistered } = useAuth()

  const [name, setName] = useState(playerName || getPlayerName())
  const [homeView, setHomeView] = useState<HomeView>('menu')
  const [activeForm, setActiveForm] = useState<HomeForm>('join')
  const [joinCode, setJoinCode] = useState('')
  const [roomPassword, setRoomPassword] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [roomName, setRoomName] = useState('')
  const [rooms, setRooms] = useState<PublicRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [queueSize, setQueueSize] = useState(0)
  const [waitedSeconds, setWaitedSeconds] = useState(0)
  const [matchSearch, setMatchSearch] = useState<MatchSearchSession | null>(null)
  const idleRetriesRef = useRef(0)

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

  useEffect(() => {
    if (!matchSearch) return

    let cancelled = false

    const poll = async () => {
      try {
        const status = await getMatchmakingStatus(matchSearch.playerId, matchSearch.accessToken)

        if (cancelled) return

        if (status.status === 'matched' && status.lobbyId) {
          setIsSearching(false)
          setMatchSearch(null)
          navigate(`/lobby/${status.lobbyId}`)
          return
        }

        if (status.status === 'queued') {
          idleRetriesRef.current = 0
          setQueueSize(status.queueSize)
          setWaitedSeconds(status.waitedSeconds)
          return
        }

        if (idleRetriesRef.current < 3) {
          idleRetriesRef.current += 1
          const rejoin = await joinMatchmaking(
            matchSearch.playerId,
            matchSearch.playerName,
            matchSearch.accessToken,
          )
          if (rejoin.status === 'matched' && rejoin.lobbyId) {
            setIsSearching(false)
            setMatchSearch(null)
            navigate(`/lobby/${rejoin.lobbyId}`)
            return
          }
          if (rejoin.status === 'queued') {
            setQueueSize(rejoin.queueSize)
            setWaitedSeconds(rejoin.waitedSeconds)
          }
          return
        }

        setError('Mất kết nối hàng chờ — hãy thử lại')
        setIsSearching(false)
        setMatchSearch(null)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Matchmaking status failed')
          setIsSearching(false)
          setMatchSearch(null)
        }
      }
    }

    void poll()
    const interval = setInterval(() => void poll(), 1500)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [matchSearch, navigate])

  const saveLocalName = () => setPlayerName(name)

  const saveAnonDisplayName = async () => {
    saveLocalName()
    const trimmed = name.trim()
    if (!trimmed || isRegistered) return
    try {
      await ensureOnlineSession(trimmed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được tên')
    }
  }

  const prepareOnline = async () => {
    saveLocalName()
    return ensureOnlineSession(name)
  }

  const showHomeMenu = () => {
    setHomeView('menu')
    setError(null)
  }

  const showHomeForm = (form: HomeForm) => {
    setActiveForm(form)
    setHomeView('form')
    setError(null)
    if (form === 'public') void refreshRooms()
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
    setLoading(true)
    idleRetriesRef.current = 0
    try {
      const session = await prepareOnline()
      const joined = await joinMatchmaking(
        session.playerId,
        session.playerName,
        session.accessToken,
      )

      if (joined.status === 'matched' && joined.lobbyId) {
        navigate(`/lobby/${joined.lobbyId}`)
        return
      }

      setQueueSize(joined.queueSize)
      setWaitedSeconds(joined.waitedSeconds)
      setIsSearching(true)
      setMatchSearch({
        playerId: session.playerId,
        playerName: session.playerName,
        accessToken: session.accessToken,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Matchmaking failed')
      setIsSearching(false)
      setMatchSearch(null)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelMatch = async () => {
    if (matchSearch) {
      await leaveMatchmaking(matchSearch.playerId, matchSearch.accessToken)
    }
    idleRetriesRef.current = 0
    setIsSearching(false)
    setMatchSearch(null)
    setQueueSize(0)
    setWaitedSeconds(0)
  }

  const footer = (
    <div className="sky-dev-footer">
      <Link to="/play/local" className="sky-dev-link">
        Chế độ test local (không server)
      </Link>
    </div>
  )

  return (
    <SkyPageLayout
      playerName={name}
      onPlayerNameChange={setName}
      onPlayerNameBlur={() => void saveAnonDisplayName()}
      footer={footer}
    >
      <div
        className="screen active home-screen"
        data-home-state={homeView}
      >
        <div id="home-menu" className="home-menu">
          <div className="home-orbit">
            <button
              type="button"
              className="menu-orb orb-join"
              data-label="Vào phòng"
              aria-label="Vào phòng"
              onClick={() => showHomeForm('join')}
            >
              <i className="bi bi-door-open-fill" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="menu-orb orb-create"
              data-label="Tạo phòng"
              aria-label="Tạo phòng"
              onClick={() => showHomeForm('create')}
            >
              <i className="bi bi-house-heart-fill" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="menu-orb orb-match"
              data-label="Tìm trận"
              aria-label="Tìm trận"
              onClick={() => showHomeForm('match')}
            >
              <i className="bi bi-dice-5-fill" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="menu-orb orb-public"
              data-label="Phòng công khai"
              aria-label="Phòng công khai"
              onClick={() => showHomeForm('public')}
            >
              <i className="bi bi-globe-asia-australia" aria-hidden="true" />
            </button>
            <Link className="guide-link" to="/guide" aria-label="Hướng dẫn chơi">
              <i className="bi bi-question-circle-fill" aria-hidden="true" />
              <span>Hướng dẫn chơi</span>
            </Link>
          </div>
        </div>

        <div id="home-forms" className="home-forms">
          <div className="home-form-stage">
            <button
              type="button"
              className="back-btn home-back-btn"
              onClick={showHomeMenu}
            >
              <i className="bi bi-arrow-left-short inline-icon" aria-hidden="true" /> Quay về
              trang chủ
            </button>

            {error ? <div className="sky-alert-error">{error}</div> : null}

            <div className="home-form-card">
              <div
                id="home-form-join"
                className={`panel p-blue home-form-panel${activeForm === 'join' ? ' active' : ''}`}
              >
                <div className="panel-head">
                  <div className="panel-icon icon-blue">
                    <i className="bi bi-door-open" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="panel-title">Vào phòng</div>
                    <div className="panel-subtitle">Nhập mã 8 ký tự để tham gia</div>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="input-wrap">
                    <input
                      className="game-input code-input"
                      type="text"
                      placeholder="MÃPHÒNG"
                      maxLength={8}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                    />
                  </div>
                  <div className="input-wrap">
                    <span className="input-icon">
                      <i className="bi bi-lock-fill" aria-hidden="true" />
                    </span>
                    <input
                      className="game-input"
                      type="password"
                      placeholder="Mật khẩu phòng (nếu có)"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="game-btn btn-blue"
                    disabled={loading || !joinCode.trim()}
                    onClick={() => void handleJoinCode()}
                  >
                    <span className="btn-icon">
                      <i className="bi bi-rocket-takeoff-fill" aria-hidden="true" />
                    </span>
                    <span>VÀO BẰNG MÃ</span>
                  </button>
                </div>
              </div>

              <div
                id="home-form-create"
                className={`panel p-green home-form-panel${activeForm === 'create' ? ' active' : ''}`}
              >
                <div className="panel-head">
                  <div className="panel-icon icon-green">
                    <i className="bi bi-house-heart-fill" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="panel-title">Tạo phòng</div>
                    <div className="panel-subtitle">Mời bạn bè cùng chơi</div>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="input-wrap">
                    <span className="input-icon">
                      <i className="bi bi-tag-fill" aria-hidden="true" />
                    </span>
                    <input
                      className="game-input"
                      type="text"
                      placeholder="Tên phòng của bạn"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                    />
                  </div>
                  <div className="input-wrap">
                    <span className="input-icon">
                      <i className="bi bi-key-fill" aria-hidden="true" />
                    </span>
                    <input
                      className="game-input"
                      type="password"
                      placeholder="Mật khẩu (tùy chọn)"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="game-btn btn-green"
                    disabled={loading}
                    onClick={() => void handleCreateRoom()}
                  >
                    <span className="btn-icon">
                      <i className="bi bi-stars" aria-hidden="true" />
                    </span>
                    <span>TẠO PHÒNG MỚI</span>
                  </button>
                </div>
              </div>

              <div
                id="home-form-match"
                className={`panel p-yellow home-form-panel${activeForm === 'match' ? ' active' : ''}`}
              >
                <div className="panel-head">
                  <div className="panel-icon icon-yellow">
                    <i className="bi bi-controller" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="panel-title">Chơi ngay!</div>
                    <div className="panel-subtitle">Tự động ghép trận nhanh nhất</div>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="mm-badge">
                    <div className="mm-dots">
                      <div className="mm-dot" />
                      <div className="mm-dot" />
                      <div className="mm-dot" />
                      <div className="mm-dot" />
                    </div>
                    <span>
                      Ghép 4 người ngay · 3 người sau 5s · 2 người sau 3s
                    </span>
                  </div>

                  {isSearching ? (
                    <div className="mm-queue-stat">
                      <div className="mm-queue-count">{queueSize}</div>
                      <div className="mm-queue-label">người đang tìm trận</div>
                      <div className="mm-queue-wait">
                        {queueSize <= 1
                          ? `Đang chờ thêm người chơi... (${waitedSeconds}s)`
                          : `Đang ghép trận... ${waitedSeconds}s`}
                      </div>
                    </div>
                  ) : null}

                  {isSearching ? (
                    <button
                      type="button"
                      className="game-btn btn-yellow"
                      onClick={() => void handleCancelMatch()}
                    >
                      <span className="btn-icon">
                        <i className="bi bi-x-circle-fill" aria-hidden="true" />
                      </span>
                      <span>HỦY TÌM TRẬN</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="game-btn btn-yellow"
                      disabled={loading}
                      onClick={() => void handleQuickMatch()}
                    >
                      <span className="btn-icon">
                        <i className="bi bi-dice-5-fill" aria-hidden="true" />
                      </span>
                      <span>TÌM TRẬN</span>
                    </button>
                  )}
                </div>
              </div>

              <div
                id="home-form-public"
                className={`panel p-red home-form-panel${activeForm === 'public' ? ' active' : ''}`}
              >
                <div className="panel-head">
                  <div className="panel-icon icon-red">
                    <i className="bi bi-globe-asia-australia" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="panel-title">Phòng công khai</div>
                    <div className="panel-subtitle">Danh sách phòng đang mở cho mọi người</div>
                  </div>
                </div>
                <div className="public-rooms-toolbar">
                  <button type="button" className="refresh-pill" onClick={() => void refreshRooms()}>
                    Làm mới
                  </button>
                </div>
                {rooms.length === 0 ? (
                  <div className="room-list-empty">Chưa có phòng nào</div>
                ) : (
                  <div className="room-list">
                    {rooms.map((room) => (
                      <PublicRoomCard
                        key={room.lobbyId}
                        room={room}
                        loading={loading}
                        onJoin={(id) => void handleJoinLobby(id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SkyPageLayout>
  )
}
