import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PLAYER_COLORS, type PlayerColor } from '@rune-race/shared'
import { SkyPageLayout } from '../components/sky/SkyPageLayout'
import { PLAYER_GRADIENT } from '../components/sky/skyColors'
import { useLobbyBackButton } from '../components/sky/useLobbyBackButton'
import { RoomChatPanel } from '../components/chat/RoomChatPanel'
import { useLobbySocket } from '../hooks/useLobbySocket'
import { usePlayerIdentity } from '../hooks/usePlayerIdentity'
import { useRoomChat } from '../hooks/useRoomChat'
import { isLikelySupabaseUserId } from '../lib/authUserId'
import { ensureOnlineSession } from '../lib/ensureOnlineSession'
import { getPlayerName, setPlayerName } from '../lib/playerSession'
import { getSocket, retainLobbyOnUnmount } from '../lib/socket'
import { supabase } from '../lib/supabase'
import { updateDisplayName } from '../lib/api'

const COLOR_TITLES: Record<PlayerColor, string> = {
  red: 'Đỏ',
  blue: 'Xanh',
  green: 'Lá',
  yellow: 'Vàng',
}

export default function LobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const password = (location.state as { password?: string } | null)?.password
  const [copied, setCopied] = useState(false)
  const [name, setName] = useState(getPlayerName())

  const { playerId, playerName, accessToken, canEditNameOnHome } = usePlayerIdentity()
  const backRef = useLobbyBackButton(Boolean(lobbyId))

  const handleLobbyRemoved = useCallback(
    (_reason: 'closed' | 'kicked' | 'disconnect_timeout') => {
      navigate('/')
    },
    [navigate],
  )

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
  } = useLobbySocket(lobbyId ?? '', playerId, playerName, password, accessToken, {
    onRemoved: handleLobbyRemoved,
  })

  const {
    messages: chatMessages,
    sendMessage: sendChatMessage,
    sendError: chatSendError,
    clearSendError: clearChatSendError,
  } = useRoomChat(snapshot ? lobbyId : undefined, playerId, accessToken)

  useEffect(() => {
    if (playerName) setName(playerName)
  }, [playerName])

  useEffect(() => {
    void ensureOnlineSession(playerName).catch(() => {})
  }, [playerName])

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
    if (!canEditNameOnHome || !accessToken) return
    try {
      await updateDisplayName(accessToken, name.trim())
      await supabase.auth.refreshSession()
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
    navigate('/')
  }

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
  const emptySlotCount = Math.max(0, maxPlayers - players.length)
  const inLobbyPhase = snapshot?.status === 'lobby' || snapshot?.status === 'countdown'
  const enteringGame = snapshot?.status === 'in_game'

  const waitingSubtitle =
    snapshot?.status === 'countdown' && snapshot.countdownSeconds !== null
      ? `Bắt đầu sau ${snapshot.countdownSeconds}s...`
      : `Đang chờ đủ ${maxPlayers} người...`

  return (
    <SkyPageLayout
      playerName={name}
      onPlayerNameChange={setName}
      onPlayerNameBlur={() => void saveAnonDisplayName()}
    >
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
        <button
          ref={backRef}
          type="button"
          className="back-btn lobby-back-btn"
          onClick={handleGoHome}
        >
          <i className="bi bi-arrow-left-short inline-icon" aria-hidden="true" /> Trang chủ
        </button>

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
          </div>
        </div>

        {error ? <div className="sky-alert-error">{error}</div> : null}

        {!snapshot && !error ? (
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
                          <i className="bi bi-person-fill" aria-hidden="true" />
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
                  {Array.from({ length: emptySlotCount }, (_, i) => (
                    <div key={`empty-${i}`} className="player-slot empty">
                      <div className="slot-strip" />
                      <div className="slot-main">
                        <div
                          className="slot-avatar"
                          style={{ background: 'rgba(150,150,150,0.4)' }}
                        >
                          <i className="bi bi-plus-lg" aria-hidden="true" />
                        </div>
                        <div className="slot-name" style={{ color: '#B0906A' }}>
                          Chỗ trống
                        </div>
                      </div>
                    </div>
                  ))}
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
                  />
                ) : null}

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
}: {
  onUpdateSettings: (p: { name?: string; password?: string; clearPassword?: boolean }) => void
  onTransferHost: (id: string) => void
  players: Array<{ id: string; name: string; isHost: boolean }>
  currentName: string
}) {
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
      <div className="panel-body">
        <div>
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
        <div>
          <div className="field-label">Mật khẩu mới</div>
          <div className="input-wrap">
            <span className="input-icon">
              <i className="bi bi-key-fill" aria-hidden="true" />
            </span>
            <input
              id="host-room-password"
              type="password"
              placeholder="Để trống nếu không đổi"
              className="game-input"
              onBlur={(e) => {
                if (e.target.value) onUpdateSettings({ password: e.target.value })
              }}
            />
          </div>
        </div>
        <button
          type="button"
          className="text-link-btn"
          onClick={() => onUpdateSettings({ clearPassword: true })}
        >
          Xóa mật khẩu
        </button>
        <div>
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
              .filter((p) => !p.isHost)
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
