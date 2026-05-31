import type { PublicRoom } from '../../lib/api'
import { roomPawnDots } from './skyColors'

type PublicRoomCardProps = {
  room: PublicRoom
  loading: boolean
  onJoin: (lobbyId: string) => void
}

export function PublicRoomCard({ room, loading, onJoin }: PublicRoomCardProps) {
  const dots = roomPawnDots(room.playerCount, room.maxPlayers)
  const isFull = room.playerCount >= room.maxPlayers

  return (
    <div className="room-card">
      <div className="room-left">
        <div className="room-pawns">
          {dots.map((dot, i) => (
            <div
              key={i}
              className={dot.filled ? 'rp' : 'rp rp-empty'}
              style={dot.filled ? { background: dot.color } : undefined}
            />
          ))}
        </div>
        <div>
          <div className="room-name">{room.name}</div>
          <div className="room-meta">
            <i
              className={`bi ${room.playerCount > 1 ? 'bi-people-fill' : 'bi-person-fill'} inline-icon`}
              aria-hidden="true"
            />{' '}
            {room.playerCount} / {room.maxPlayers} người chơi
            {room.hasPassword ? ' · có mật khẩu' : ''}
          </div>
        </div>
      </div>
      <button
        type="button"
        className="join-btn"
        disabled={loading || isFull}
        onClick={() => onJoin(room.lobbyId)}
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
  )
}
