import { useEffect, useId, useRef } from 'react'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Use red styling for destructive actions (e.g. leave game). */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="game-hud-backdrop" aria-hidden />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="game-hud-modal game-hud-modal--sm"
      >
        <h2 id={titleId} className="game-hud-modal-title">
          {title}
        </h2>
        <p id={messageId} className="game-hud-modal-body">
          {message}
        </p>

        <div className="game-hud-modal-actions">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="game-btn btn-outline"
          >
            <span>{cancelLabel}</span>
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={destructive ? 'btn-leave game-btn' : 'game-btn btn-yellow'}
          >
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
