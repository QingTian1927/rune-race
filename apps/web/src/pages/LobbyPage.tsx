import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PLAYER_COLORS, type PlayerColor } from '@rune-race/shared'
import { AccountNudgeModal } from '../components/account/AccountNudgeModal'
import { LobbyKickedOverlay } from '../components/lobby/LobbyKickedOverlay'
import { SkyPageLayout } from '../components/sky/SkyPageLayout'
import { PLAYER_GRADIENT } from '../components/sky/skyColors'
import { RoomChatPanel } from '../components/chat/RoomChatPanel'
import { useLobbySocket } from '../hooks/useLobbySocket'
import { useAuth } from '../hooks/useAuth'
import { useFeatureFlags } from '../hooks/useFeatureFlags'
import { usePlayerIdentity } from '../hooks/usePlayerIdentity'
import { markLobbyNudgeDismissed, wasLobbyNudgeDismissed } from '../lib/accountNudge'
import { useRoomChat } from '../hooks/useRoomChat'
import { isLikelySupabaseUserId } from '../lib/authUserId'
import { fetchRoomById, leaveMatchmaking } from '../lib/api'
import { ensureOnlineSession } from '../lib/ensureOnlineSession'
import { getPlayerName, setPlayerName } from '../lib/playerSession'
import { getSocket, retainLobbyOnUnmount } from '../lib/socket'

const COLOR_TITLES: Record<PlayerColor, string> = {
  red: 'Đỏ',
  blue: 'Xanh',
  green: 'Lá',
  yellow: 'Vàng',
}

const LOBBY_RUNE_DESCRIPTION =
  'Bốc thẻ ngẫu nhiên, đặt bí mật trên bàn cờ và kích hoạt hiệu ứng khi quân di chuyển — thêm lớp chiến thuật cho ván Cá ngựa.'

export default function LobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const routePassword = (location.state as { password?: string } | null)?.password?.trim() ?? ''
  const [joinPassword, setJoinPassword] = useState(routePassword)
  const [roomHasPassword, setRoomHasPassword] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)
  const [name, setName] = useState(getPlayerName())

  useEffect(() => {
    setJoinPassword(routePassword)
  }, [routePassword, lobbyId])

  useEffect(() => {
    if (!lobbyId) return
    let cancelled = false
    void fetchRoomById(lobbyId)
      .then((room) => {
        if (!cancelled) setRoomHasPassword(room.hasPassword)
      })
      .catch(() => {
        if (!cancelled) {
          setRoomHasPassword(null)
          navigate('/', {
            replace: true,
            state: { lobbyError: 'Phòng không còn tồn tại — có thể đã bị đóng.' },
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [lobbyId, navigate])

  const resolvedPassword = joinPassword.trim() || undefined
  const needsPassword = roomHasPassword === true
  const canAttemptJoin =
    Boolean(lobbyId) &&
    roomHasPassword !== null &&
    (!needsPassword || Boolean(resolvedPassword))

  const { loading: authLoading, isRegistered } = useAuth()
  const { accountNudgeEnabled, loading: flagsLoading } = useFeatureFlags()
  const { playerId, playerName, accessToken, canEditNameOnHome, identityReady } = usePlayerIdentity()
  const [nudgeOpen, setNudgeOpen] = useState(false)
  const [kickedOverlayOpen, setKickedOverlayOpen] = useState(false)
  const canShowNudge =
    accountNudgeEnabled && !isRegistered && !authLoading && !flagsLoading

  const closeLobbyNudge = useCallback(() => {
    if (lobbyId) markLobbyNudgeDismissed(lobbyId)
    setNudgeOpen(false)
  }, [lobbyId])

  useEffect(() => {
    if (isRegistered) setNudgeOpen(false)
  }, [isRegistered])

  const handleLobbyRemoved = useCallback(
    (reason: 'closed' | 'kicked' | 'disconnect_timeout') => {
      if (reason === 'kicked') {
        setKickedOverlayOpen(true)
        return
      }
      navigate('/play')
    },
    [navigate],
  )

  const dismissKickedOverlay = useCallback(() => {
    setKickedOverlayOpen(false)
    navigate('/play')
  }, [navigate])

  const {
    snapshot,
    hostRoomPassword,
    error,
    connected,
    setColor,
    setReady,
    leave,
    kick,
    addBot,
    cancelCountdown,
    updateSettings,
    transferHost,
  } = useLobbySocket(lobbyId ?? '', playerId, playerName, resolvedPassword, accessToken, {
    enabled: identityReady && canAttemptJoin,
    onRemoved: handleLobbyRemoved,
  })

  const passwordMismatch = /invalid password/i.test(error ?? '')
  const showPasswordGate =
    Boolean(lobbyId) &&
    !snapshot &&
    ((needsPassword && !resolvedPassword) || passwordMismatch)

  const {
    messages: chatMessages,
    sendMessage: sendChatMessage,
    sendError: chatSendError,
    clearSendError: clearChatSendError,
  } = useRoomChat(snapshot ? lobbyId : undefined, playerId, accessToken, {
    enabled: identityReady,
  })

  useEffect(() => {
    if (playerName) setName(playerName)
  }, [playerName])

  useEffect(() => {
    void ensureOnlineSession(playerName).catch(() => {})
  }, [playerName])

  useEffect(() => {
    if (!lobbyId || !canShowNudge || wasLobbyNudgeDismissed(lobbyId)) return
    if (!identityReady || !snapshot) return
    const timer = window.setTimeout(() => setNudgeOpen(true), 400)
    return () => window.clearTimeout(timer)
  }, [lobbyId, identityReady, snapshot, canShowNudge])

  useEffect(() => {
    if (!lobbyId) return
    const socket = getSocket(accessToken)

    const onGameStarted = (payload: { gameId: string; lobbyId: string }) => {
      sessionStorage.setItem('rune-race-lobby-id', payload.lobbyId)
      retainLobbyOnUnmount(payload.lobbyId)
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
      retainLobbyOnUnmount(snapshot.lobbyId)
      navigate(`/game/${snapshot.currentGameId}`)
    }
  }, [snapshot?.status, snapshot?.currentGameId, snapshot?.lobbyId, navigate])

  const saveAnonDisplayName = async () => {
    setPlayerName(name)
    const trimmed = name.trim()
    if (!trimmed || !canEditNameOnHome) return
    try {
      await ensureOnlineSession(trimmed)
    } catch {
      // ignore on lobby
    }
  }

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

  const handleGoHome = () => {
    leave()
    if (playerId) {
      void leaveMatchmaking(playerId, accessToken)
    }
    navigate('/play')
  }

  const homeNavButton = (
    <button type="button" className="nav-btn" onClick={handleGoHome}>
      <i className="bi bi-arrow-left-short inline-icon" aria-hidden="true" /> Trang chủ
    </button>
  )

  if (!lobbyId) {
    return (
      <SkyPageLayout
        playerName={name}
        onPlayerNameChange={setName}
        onPlayerNameBlur={() => void saveAnonDisplayName()}
      >
        <p className="room-list-empty">Invalid lobby</p>
      </SkyPageLayout>
    )
  }

  const me = snapshot?.players.find((p) => p.id === playerId)
  const isHost = me?.isHost ?? false
  const maxPlayers = snapshot?.settings.maxPlayers ?? 4
  const players = snapshot?.players ?? []
  const humanCount = players.filter((p) => !p.isBot).length
  const botCount = players.filter((p) => p.isBot).length
  const emptySlotCount = Math.max(0, maxPlayers - players.length)
  const inLobbyPhase = snapshot?.status === 'lobby' || snapshot?.status === 'countdown'
  const enteringGame = snapshot?.status === 'in_game'
  const runesEnabled = snapshot?.settings.runesEnabled ?? true

  const waitingSubtitle =
    snapshot?.status === 'countdown' && snapshot.countdownSeconds !== null
      ? `Bắt đầu sau ${snapshot.countdownSeconds}s...`
      : botCount > 0
        ? `${humanCount} / ${maxPlayers} người chơi · ${botCount} bot — bấm SẴN SÀNG để bắt đầu`
        : `Đang chờ đủ ${maxPlayers} người...`

  return (
    <SkyPageLayout
      playerName={name}
      onPlayerNameChange={setName}
      onPlayerNameBlur={() => void saveAnonDisplayName()}
      topNavExtra={homeNavButton}
    >
      <AccountNudgeModal open={nudgeOpen} onClose={closeLobbyNudge} />
      <LobbyKickedOverlay open={kickedOverlayOpen} onDismiss={dismissKickedOverlay} />
      {snapshot ? (
        <RoomChatPanel
          placement="lobby"
          messages={chatMessages}
          localPlayerId={playerId}
          onSend={sendChatMessage}
          sendError={chatSendError}
          onClearSendError={clearChatSendError}
        />
      ) : null}

      <div className="lobby-screen">
        <div className="lobby-stack">
          <div className="lobby-header">
          <div className="code-row">
            <div className="code-label">Room code</div>
            <div className="code-tag">{snapshot?.joinCode ?? '...'}</div>
            <button type="button" className="copy-pill" onClick={() => void copyJoinCode()}>
              {copied ? (
                <>
                  <i className="bi bi-check2-circle inline-icon" aria-hidden="true" /> Đã copy!
                </>
              ) : (
                <>
                  <i className="bi bi-clipboard-check inline-icon" aria-hidden="true" /> Copy
                </>
              )}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px', gap: '8px', flexWrap: 'wrap' }}>
            <div className="connected-tag">
              <div className="conn-dot" />
              {connected ? 'Đã kết nối' : 'Đang kết nối...'}
            </div>
            {snapshot?.status === 'countdown' && snapshot.countdownSeconds !== null ? (
              <div className="connected-tag" style={{ borderColor: 'rgba(255,200,60,0.6)', color: '#9A5500' }}>
                Bắt đầu sau {snapshot.countdownSeconds}s
              </div>
            ) : null}
            {snapshot ? (
              <div
                className={[
                  'connected-tag',
                  'lobby-rune-header-tag',
                  runesEnabled ? 'lobby-rune-header-tag--on' : 'lobby-rune-header-tag--off',
                ].join(' ')}
              >
                <i className="bi bi-stars inline-icon" aria-hidden="true" />
                Rune: {runesEnabled ? 'Bật' : 'Tắt'}
              </div>
            ) : null}
          </div>
        </div>

        {error && !showPasswordGate ? <div className="sky-alert-error">{error}</div> : null}

        {showPasswordGate ? (
          <div className="panel p-blue lobby-password-gate">
            <div className="panel-head">
              <div className="panel-icon icon-blue">
                <i className="bi bi-lock-fill" aria-hidden="true" />
              </div>
              <div>
                <div className="panel-title">Mật khẩu phòng</div>
                <div className="panel-subtitle">
                  {passwordMismatch
                    ? 'Mật khẩu không đúng — thử lại'
                    : 'Phòng này được bảo vệ bằng mật khẩu'}
                </div>
              </div>
            </div>
            <div className="panel-body">
              <div className="input-wrap">
                <span className="input-icon">
                  <i className="bi bi-key-fill" aria-hidden="true" />
                </span>
                <input
                  type="password"
                  className="game-input"
                  placeholder="Nhập mật khẩu"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && joinPassword.trim()) {
                      e.preventDefault()
                    }
                  }}
                  autoFocus
                />
              </div>
              <button
                type="button"
                className="game-btn btn-blue"
                disabled={!joinPassword.trim() || !identityReady}
                onClick={() => {
                  if (!joinPassword.trim()) return
                }}
              >
                Vào phòng
              </button>
            </div>
          </div>
        ) : null}

        {!snapshot && !error && !showPasswordGate ? (
          <p className="room-list-empty">Đang tải phòng...</p>
        ) : null}

        {snapshot ? (
          <>
            <div className="lobby-columns">
              <div className="panel p-blue">
                <div className="panel-head">
                  <div className="panel-icon icon-blue">
                    <i className="bi bi-people-fill" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="panel-title">Người chơi</div>
                    <div className="panel-subtitle">{waitingSubtitle}</div>
                  </div>
                </div>
                <div className="slot-grid">
                  {players.map((player) => (
                    <div key={player.id} className="player-slot filled">
                      <div className="slot-strip" />
                      <div className="slot-main">
                        <div
                          className="slot-avatar"
                          style={{
                            background: player.color
                              ? PLAYER_GRADIENT[player.color]
                              : 'rgba(150,150,150,0.4)',
                          }}
                        >
                          <i
                            className={player.isBot ? 'bi bi-robot' : 'bi bi-person-fill'}
                            aria-hidden="true"
                          />
                        </div>
                        {isLikelySupabaseUserId(player.id) ? (
                          <Link to={`/profile/${player.id}`} className="slot-name">
                            {player.name}
                          </Link>
                        ) : (
                          <div className="slot-name">{player.name}</div>
                        )}
                      </div>
                      {player.isHost ? (
                        <span className="slot-badge badge-host">HOST</span>
                      ) : null}
                      {player.isBot ? (
                        <span className="slot-badge badge-bot">BOT</span>
                      ) : null}
                      {player.ready ? (
                        <span className="slot-badge badge-ready">SẴN SÀNG</span>
                      ) : (
                        <div className="slot-status">
                          {!player.connected ? 'Offline · ' : ''}Chờ...
                        </div>
                      )}
                      {isHost && player.id !== playerId && snapshot.status === 'lobby' ? (
                        <button
                          type="button"
                          className="kick-pill"
                          onClick={() => kick(player.id)}
                        >
                          Kick
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {Array.from({ length: emptySlotCount }, (_, i) => {
                    const showAddBot = isHost && snapshot.status === 'lobby' && i === 0
                    return (
                      <div key={`empty-${i}`} className="player-slot empty">
                        <div className="slot-strip" />
                        <div className="slot-main">
                          <div
                            className="slot-avatar"
                            style={{ background: 'rgba(150,150,150,0.4)' }}
                          >
                            <i
                              className={showAddBot ? 'bi bi-robot' : 'bi bi-plus-lg'}
                              aria-hidden="true"
                            />
                          </div>
                          <div className="slot-name" style={{ color: '#B0906A' }}>
                            Chỗ trống
                          </div>
                        </div>
                        {showAddBot ? (
                          <button
                            type="button"
                            className="add-bot-pill"
                            onClick={addBot}
                          >
                            <i className="bi bi-plus-lg inline-icon" aria-hidden="true" /> Thêm bot
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="panel p-yellow">
                <div className="color-section lobby-color">
                  <div className="color-options">
                    {PLAYER_COLORS.map((color) => {
                      const taken = snapshot.takenColors.includes(color)
                      const selected = me?.color === color
                      return (
                        <button
                          key={color}
                          type="button"
                          className={`color-orb${selected ? ' selected' : ''}${taken && !selected ? ' disabled' : ''}`}
                          style={{ background: PLAYER_GRADIENT[color] }}
                          title={COLOR_TITLES[color]}
                          disabled={taken && !selected}
                          onClick={() => setColor(color)}
                        >
                          {selected ? (
                            <i className="bi bi-check-lg color-orb-check" aria-hidden="true" />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {inLobbyPhase ? (
              <>
                {isHost ? (
                  <HostPanel
                    onUpdateSettings={updateSettings}
                    onTransferHost={transferHost}
                    players={players}
                    currentName={snapshot.settings.name ?? ''}
                    hasPassword={snapshot.settings.hasPassword}
                    runesEnabled={runesEnabled}
                    roomPassword={hostRoomPassword}
                  />
                ) : (
                  <LobbyRuneGuestPanel runesEnabled={runesEnabled} />
                )}

                <div className="lobby-actions">
                  <button
                    type="button"
                    className="game-btn btn-green"
                    disabled={!me?.color}
                    onClick={() => setReady(!me?.ready)}
                  >
                    <span className="btn-icon">
                      <i className="bi bi-check-circle-fill" aria-hidden="true" />
                    </span>
                    <span>{me?.ready ? 'HỦY SẴN SÀNG' : 'SẴN SÀNG!'}</span>
                  </button>

                  {isHost && snapshot.status === 'countdown' ? (
                    <button type="button" className="game-btn btn-yellow" onClick={cancelCountdown}>
                      <span className="btn-icon">
                        <i className="bi bi-stop-circle-fill" aria-hidden="true" />
                      </span>
                      <span>HỦY ĐẾM NGƯỢC</span>
                    </button>
                  ) : null}

                  <button type="button" className="btn-leave" onClick={handleGoHome}>
                    <i className="bi bi-box-arrow-left inline-icon" aria-hidden="true" /> Rời phòng
                  </button>
                </div>
              </>
            ) : enteringGame ? (
              <p className="room-list-empty">Đang chuyển vào game...</p>
            ) : null}
          </>
        ) : null}
        </div>
      </div>
    </SkyPageLayout>
  )
}

function HostPanel({
  onUpdateSettings,
  onTransferHost,
  players,
  currentName,
  hasPassword,
  runesEnabled,
  roomPassword,
}: {
  onUpdateSettings: (p: {
    name?: string
    password?: string
    clearPassword?: boolean
    runesEnabled?: boolean
  }) => void
  onTransferHost: (id: string) => void
  players: Array<{ id: string; name: string; isHost: boolean; isBot?: boolean }>
  currentName: string
  hasPassword: boolean
  runesEnabled: boolean
  roomPassword: string | null
}) {
  const [draftPassword, setDraftPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)

  useEffect(() => {
    if (roomPassword !== null) {
      setDraftPassword(roomPassword)
    } else if (!hasPassword) {
      setDraftPassword('')
    }
  }, [roomPassword, hasPassword])

  const handleClearPassword = () => {
    setDraftPassword('')
    setShowPassword(false)
    onUpdateSettings({ clearPassword: true })
    setSettingsMessage('Đã xóa mật khẩu phòng')
  }

  return (
    <div className="panel p-green lobby-panel-host">
      <div className="panel-head">
        <div className="panel-icon icon-green">
          <i className="bi bi-gear-fill" aria-hidden="true" />
        </div>
        <div>
          <div className="panel-title">Cài đặt host</div>
          <div className="panel-subtitle">Quản lý phòng và chuyển quyền host</div>
        </div>
      </div>
      <div className="panel-body lobby-panel-host-body">
        <div className="field-block">
          <div className="field-label">Tên phòng</div>
          <input
            id="host-room-name"
            defaultValue={currentName}
            className="game-input"
            style={{ paddingLeft: '16px' }}
            onBlur={(e) => {
              if (e.target.value.trim()) onUpdateSettings({ name: e.target.value.trim() })
            }}
          />
        </div>
        <div className="field-block">
          <div className="field-label">Mật khẩu phòng</div>
          <div className="input-wrap host-password-wrap">
            <span className="input-icon">
              <i className="bi bi-key-fill" aria-hidden="true" />
            </span>
            <input
              id="host-room-password"
              type={showPassword ? 'text' : 'password'}
              placeholder={hasPassword ? 'Mật khẩu hiện tại' : 'Đặt mật khẩu phòng'}
              className="game-input host-password-input"
              value={draftPassword}
              onChange={(e) => setDraftPassword(e.target.value)}
              onBlur={() => {
                const trimmed = draftPassword.trim()
                if (!trimmed) return
                if (trimmed === (roomPassword ?? '')) return
                onUpdateSettings({ password: trimmed })
                setSettingsMessage('Đã cập nhật mật khẩu phòng')
              }}
              autoComplete="off"
            />
            <button
              type="button"
              className="host-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
            >
              <i
                className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}
                aria-hidden="true"
              />
            </button>
          </div>
          <button
            type="button"
            className="text-link-btn"
            disabled={!hasPassword && !draftPassword.trim()}
            onClick={handleClearPassword}
          >
            Xóa mật khẩu
          </button>
        </div>
        {settingsMessage ? <p className="muted lobby-settings-hint">{settingsMessage}</p> : null}
        <div className="field-block lobby-host-rune-block">
          <div className="field-label">Hệ thống Rune</div>
          <p className="lobby-field-desc">{LOBBY_RUNE_DESCRIPTION}</p>
          <label
            className={['lobby-rune-toggle', runesEnabled ? 'lobby-rune-toggle--on' : ''].join(' ')}
          >
            <input
              type="checkbox"
              className="lobby-rune-toggle-input"
              checked={runesEnabled}
              onChange={(e) => {
                onUpdateSettings({ runesEnabled: e.target.checked })
              }}
            />
            <span className="lobby-rune-toggle-field">
              <span className="lobby-rune-toggle-icon" aria-hidden="true">
                <i className="bi bi-stars" />
              </span>
              <span className="lobby-rune-toggle-label">Bật cho ván này</span>
              <span className="lobby-rune-toggle-track" aria-hidden="true">
                <span className="lobby-rune-toggle-thumb" />
              </span>
            </span>
          </label>
        </div>
        <div className="field-block">
          <div className="field-label">Chuyển host</div>
          <select
            id="host-transfer"
            className="game-input"
            style={{ paddingLeft: '16px' }}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onTransferHost(e.target.value)
            }}
          >
            <option value="">Chọn người chơi</option>
            {players
              .filter((p) => !p.isHost && !p.isBot)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>
    </div>
  )
}

function LobbyRuneStatusRow({ runesEnabled }: { runesEnabled: boolean }) {
  return (
    <div
      className={[
        'lobby-rune-toggle-field',
        'lobby-rune-status-field',
        runesEnabled ? 'lobby-rune-status-field--on' : '',
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      <span className="lobby-rune-toggle-icon" aria-hidden="true">
        <i className="bi bi-stars" />
      </span>
      <span className="lobby-rune-toggle-label">
        {runesEnabled ? 'Đang bật cho ván này' : 'Không dùng trong ván này'}
      </span>
      <span
        className={[
          'lobby-rune-status-badge',
          runesEnabled ? 'lobby-rune-status-badge--on' : 'lobby-rune-status-badge--off',
        ].join(' ')}
      >
        {runesEnabled ? 'Bật' : 'Tắt'}
      </span>
    </div>
  )
}

function LobbyRuneGuestPanel({ runesEnabled }: { runesEnabled: boolean }) {
  return (
    <div className="panel p-green lobby-rune-guest-panel">
      <div className="panel-head">
        <div className="panel-icon icon-green">
          <i className="bi bi-stars" aria-hidden="true" />
        </div>
        <div>
          <div className="panel-title">Hệ thống Rune</div>
          <div className="panel-subtitle">Host quyết định trước khi vào ván</div>
        </div>
      </div>
      <div className="panel-body lobby-panel-host-body">
        <p className="lobby-field-desc">{LOBBY_RUNE_DESCRIPTION}</p>
        <LobbyRuneStatusRow runesEnabled={runesEnabled} />
      </div>
    </div>
  )
}
