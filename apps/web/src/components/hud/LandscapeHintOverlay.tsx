import { useEffect, useId, useRef } from 'react'

type LandscapeHintOverlayProps = {
  open: boolean
  onDismiss: () => void
  onDismissForever: () => void
}

export function LandscapeHintOverlay({
  open,
  onDismiss,
  onDismissForever,
}: LandscapeHintOverlayProps) {
  const titleId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    primaryRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      className="landscape-hint-root"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      <div className="game-hud-backdrop" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="game-hud-modal landscape-hint-sheet"
      >
        <div className="landscape-hint-visual" aria-hidden>
          <span className="landscape-hint-phone">📱</span>
          <span className="landscape-hint-arrow">↻</span>
        </div>

        <h2 id={titleId} className="game-hud-modal-title landscape-hint-title">
          Xoay ngang điện thoại
        </h2>
        <p className="game-hud-modal-body landscape-hint-body">
          Chơi ở chế độ ngang sẽ thoải mái hơn — bạn nhìn bàn cờ và các nút điều khiển rõ hơn.
        </p>

        <div className="game-hud-modal-actions landscape-hint-actions">
          <button
            ref={primaryRef}
            type="button"
            className="game-btn btn-blue"
            onClick={onDismiss}
          >
            Đã hiểu
          </button>
          <button type="button" className="btn-leave" onClick={onDismissForever}>
            Không nhắc lại
          </button>
        </div>
      </div>
    </div>
  )
}
