import { useEffect, useId, useRef } from 'react'
import type { GraphicsQuality } from '../../lib/graphicsQuality'
import { usePresenceTransition } from './usePresenceTransition'

export type GameSettingsOverlayProps = {
  open: boolean
  quality: GraphicsQuality
  onQualityChange: (quality: GraphicsQuality) => void
  onClose: () => void
}

export function GameSettingsOverlay({
  open,
  quality,
  onQualityChange,
  onClose,
}: GameSettingsOverlayProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const { render, motionClass } = usePresenceTransition(open, 260)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!render) return null

  return (
    <div
      className={['game-hud-overlay-root pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4', motionClass]
        .filter(Boolean)
        .join(' ')}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="game-hud-backdrop" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="game-hud-modal game-hud-modal--sm game-hud-modal--motion"
      >
        <div className="game-hud-modal-head">
          <div className="game-hud-modal-icon" aria-hidden>
            <i className="bi bi-gear-fill" />
          </div>
          <h2 id={titleId} className="game-hud-modal-title">
            Cài đặt
          </h2>
        </div>

        <p className="game-hud-settings-label">Đồ họa</p>
        <div className="game-hud-quality-toggle" role="group" aria-label="Chất lượng đồ họa">
          <button
            type="button"
            className={
              quality === 'low'
                ? 'game-hud-quality-option game-hud-quality-option--active'
                : 'game-hud-quality-option'
            }
            aria-pressed={quality === 'low'}
            onClick={() => onQualityChange('low')}
          >
            <span className="game-hud-quality-option-emoji" aria-hidden>
              🥔
            </span>
            <span>Thấp</span>
          </button>
          <button
            type="button"
            className={
              quality === 'high'
                ? 'game-hud-quality-option game-hud-quality-option--active'
                : 'game-hud-quality-option'
            }
            aria-pressed={quality === 'high'}
            onClick={() => onQualityChange('high')}
          >
            <span className="game-hud-quality-option-emoji" aria-hidden>
              💎
            </span>
            <span>Cao</span>
          </button>
        </div>
        <p className="game-hud-settings-hint">
          {quality === 'low'
            ? 'Tối đa FPS: không bóng, không khử răng cưa, đồ họa phẳng và tắt hiệu ứng.'
            : 'Đồ họa đầy đủ — bóng, ánh sáng và hiệu ứng bàn cờ.'}
        </p>

        <div className="game-hud-modal-actions">
          <button ref={closeRef} type="button" onClick={onClose} className="game-btn btn-yellow">
            <span className="btn-icon">
              <i className="bi bi-check-lg" aria-hidden="true" />
            </span>
            <span>Đóng</span>
          </button>
        </div>
      </div>
    </div>
  )
}
