import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useMyProfilePath, usePlayerIdentity } from '../../hooks/usePlayerIdentity'

type GameHeaderProps = {
  name: string
  onNameChange: (value: string) => void
  onNameBlur: () => void
}

export function GameHeader({ name, onNameChange, onNameBlur }: GameHeaderProps) {
  const { signOut, isRegistered } = useAuth()
  const { playerName, avatarEmoji, canEditNameOnHome } = usePlayerIdentity()
  const profilePath = useMyProfilePath()

  return (
    <div className="game-header" style={{ position: 'relative', width: '100%', maxWidth: '980px' }}>
      <div className="top-nav">
        {isRegistered ? (
          <>
            {profilePath ? (
              <Link to={profilePath} className="nav-btn">
                Profile
              </Link>
            ) : null}
            <button type="button" className="nav-btn" onClick={() => void signOut()}>
              Đăng xuất
            </button>
          </>
        ) : (
          <>
            <Link to="/auth/login" className="nav-btn">
              Đăng nhập
            </Link>
            <Link to="/auth/signup" className="nav-btn">
              Đăng ký
            </Link>
          </>
        )}
      </div>

      <div className="logo-wrap">
        <div className="logo-board">
          <div className="game-title">Rune Race</div>
          <div className="game-tagline">Cá ngựa online · chơi ẩn danh</div>
        </div>
      </div>

      <div className="pawn-parade">
        <PawnFigure head="#4FC870,#2E9452" body="#2E9452" />
        <PawnFigure head="#5BA8FF,#2E78D0" body="#2E78D0" />
        <PawnFigure head="#FFD740,#E8A000" body="#E8A000" />
        <PawnFigure head="#FF6B60,#D93025" body="#D93025" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="player-chip">
          {avatarEmoji ? (
            <span className="player-chip-emoji" aria-hidden="true">
              {avatarEmoji}
            </span>
          ) : (
            <div className="player-dot" />
          )}
          {isRegistered ? (
            <>
              <span>{playerName}</span>
              <Link to="/profile/edit" className="player-chip-link">
                Sửa
              </Link>
            </>
          ) : (
            <input
              className="player-chip-input"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onBlur={onNameBlur}
              placeholder="Player"
              maxLength={50}
              aria-label="Tên hiển thị"
              disabled={!canEditNameOnHome && Boolean(playerName)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function PawnFigure({ head, body }: { head: string; body: string }) {
  const [c1, c2] = head.split(',')
  return (
    <div className="pawn-figure">
      <div
        className="pawn-head"
        style={{ background: `linear-gradient(135deg,${c1},${c2})` }}
      />
      <div className="pawn-neck" style={{ background: body }} />
      <div className="pawn-body" style={{ background: body, borderRadius: '4px 4px 2px 2px' }} />
      <div className="pawn-shadow-el" />
    </div>
  )
}
