import { useEffect, useId, useRef } from 'react'
import { gameBtnGhost, gameSectionTitle } from '../../lib/gameUiStyles'

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

const confirmBtnBase =
  'rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-150 active:scale-95'
const confirmBtnDefault = `${confirmBtnBase} border-2 border-amber-300 bg-amber-50/95 text-amber-900 hover:bg-amber-100`
const confirmBtnDestructive = `${confirmBtnBase} border-2 border-red-300 bg-red-50/95 text-red-800 hover:bg-red-100`

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
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" aria-hidden />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="relative w-full max-w-sm rounded-2xl border border-gray-200/90 bg-white/90 px-6 py-5 shadow-2xl backdrop-blur-md"
      >
        <h2 id={titleId} className={`${gameSectionTitle} text-base`}>
          {title}
        </h2>
        <p id={messageId} className="mt-2 text-sm leading-relaxed text-stone-600">
          {message}
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={`${gameBtnGhost} sm:min-w-[5.5rem]`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${destructive ? confirmBtnDestructive : confirmBtnDefault} sm:min-w-[5.5rem]`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
