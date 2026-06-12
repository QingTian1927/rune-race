import type { PublicRoom } from '../../lib/api'
import { roomPawnDots } from './skyColors'

type PublicRoomCardProps = {
  room: PublicRoom
  loading: boolean
  needsPasswordPrompt?: boolean
  roomPassword?: string
  onRoomPasswordChange?: (value: string) => void
  onJoin: () => void
}

function formatRoomOccupancy(room: PublicRoom): string {
  const humans = room.humanPlayerCount ?? room.playerCount
  const bots = room.botCount ?? 0
  const base = `${humans} / ${room.maxPlayers} người chơi`
  if (bots <= 0) return base
  return `${base} · ${bots} bot`
}

export function PublicRoomCard({
  room,
  loading,
  needsPasswordPrompt,
  roomPassword = '',
  onRoomPasswordChange,
  onJoin,
}: PublicRoomCardProps) {
  const humans = room.humanPlayerCount ?? room.playerCount
  const bots = room.botCount ?? 0
  const dots = roomPawnDots(humans, room.maxPlayers, bots)
  const isFull = humans >= room.maxPlayers && bots === 0

  return (
    <div className="room-card">
      <div className="room-left">
        <div className="room-pawns">
          {dots.map((dot, i) => (
            <div
              key={i}
              className={
                dot.kind === 'human'
                  ? 'rp'
                  : dot.kind === 'bot'
                    ? 'rp rp-bot'
                    : 'rp rp-empty'
              }
              style={dot.kind === 'human' ? { background: dot.color } : undefined}
            />
          ))}
        </div>
        <div>
          <div className="room-name">{room.name}</div>
          <div className="room-meta">
            <i
              className={`bi ${humans > 1 ? 'bi-people-fill' : 'bi-person-fill'} inline-icon`}
              aria-hidden="true"
            />{' '}
            {formatRoomOccupancy(room)}
            {room.hasPassword ? ' · có mật khẩu' : ''}
          </div>
        </div>
      </div>
      <div className="room-card-actions">
        {needsPasswordPrompt ? (
          <div className="room-card-password-prompt">
            <input
              type="password"
              className="game-input"
              placeholder="Mật khẩu phòng"
              value={roomPassword}
              onChange={(e) => onRoomPasswordChange?.(e.target.value)}
              autoFocus
            />
            <p className="muted room-card-password-hint">Phòng này yêu cầu mật khẩu</p>
          </div>
        ) : null}
        <button
          type="button"
          className="join-btn"
          disabled={loading || isFull}
          onClick={onJoin}
        >
          {isFull ? (
            <>
              Xem <i className="bi bi-eye-fill inline-icon" aria-hidden="true" />
            </>
          ) : (
            <>
              Vào <i className="bi bi-arrow-right-short inline-icon" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
