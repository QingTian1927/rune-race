import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type LobbyKickedOverlayProps = {
  open: boolean
  onDismiss: () => void
}

export function LobbyKickedOverlay({ open, onDismiss }: LobbyKickedOverlayProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onDismiss])

  if (!open) return null

  return createPortal(
    <div className="lobby-kicked-overlay" role="presentation">
      <div
        className="lobby-kicked-dialog panel p-red"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lobby-kicked-title"
        aria-describedby="lobby-kicked-desc"
      >
        <div className="panel-head">
          <div className="panel-icon icon-red">
            <i className="bi bi-door-open-fill" aria-hidden="true" />
          </div>
          <div>
            <h2 id="lobby-kicked-title" className="panel-title lobby-kicked-title">
              Bạn đã bị kick khỏi phòng
            </h2>
            <p id="lobby-kicked-desc" className="panel-subtitle lobby-kicked-lead">
              Bạn không còn trong phòng này. Hãy tìm phòng khác hoặc ghép trận mới nhé.
            </p>
          </div>
        </div>

        <div className="panel-body lobby-kicked-body">
          <button type="button" className="game-btn btn-yellow" onClick={onDismiss}>
            <span className="btn-icon">
              <i className="bi bi-house-door-fill" aria-hidden="true" />
            </span>
            <span>VỀ TRANG CHỦ</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
