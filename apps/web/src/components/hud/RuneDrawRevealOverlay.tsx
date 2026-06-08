import { useEffect, useId, useRef } from 'react'
import type { HeldCard } from '@rune-race/shared'
import {
  RUNE_CARD_DESCRIPTIONS,
  RUNE_CARD_IMAGES,
  RUNE_CARD_LABELS,
} from '../../lib/runeAssets'

type RuneDrawRevealOverlayProps = {
  open: boolean
  card: HeldCard | null
  onConfirm: () => void
}

export function RuneDrawRevealOverlay({ open, card, onConfirm }: RuneDrawRevealOverlayProps) {
  const titleId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onConfirm()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onConfirm])

  if (!open || !card) return null

  const label = RUNE_CARD_LABELS[card.cardType]
  const description = RUNE_CARD_DESCRIPTIONS[card.cardType]

  return (
    <div className="rune-card-preview-root rune-card-preview-root--draw" role="presentation">
      <div className="game-hud-backdrop" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="rune-card-preview-sheet rune-card-preview-sheet--draw-reveal"
      >
        <p className="rune-card-preview-kicker">Bốc được thẻ mới</p>

        <div className="rune-card-preview-art-wrap rune-card-preview-art-wrap--reveal">
          <img
            src={RUNE_CARD_IMAGES[card.cardType]}
            alt=""
            className="rune-card-preview-art"
          />
          <span className="rune-card-preview-ttl" aria-label={`Còn ${card.remainingHandRounds} lượt`}>
            {card.remainingHandRounds}
          </span>
        </div>

        <div className="rune-card-preview-copy">
          <h2 id={titleId} className="rune-card-preview-title">
            {label}
          </h2>
          <p className="rune-card-preview-desc">{description}</p>
        </div>

        <div className="rune-card-preview-actions rune-card-preview-actions--single">
          <button
            ref={confirmRef}
            type="button"
            className="game-btn btn-blue rune-card-preview-btn"
            onClick={onConfirm}
          >
            Nhận thẻ
          </button>
        </div>
      </div>
    </div>
  )
}
