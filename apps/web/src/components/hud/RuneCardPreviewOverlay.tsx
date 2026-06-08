import { useEffect, useId, useRef } from 'react'
import type { HeldCard, Player } from '@rune-race/shared'
import {
  RUNE_CARD_DESCRIPTIONS,
  RUNE_CARD_IMAGES,
  RUNE_CARD_LABELS,
} from '../../lib/runeAssets'
import { PlayerBadge } from './PlayerBadge'

export type RuneCardPreviewMode = 'preview' | 'confirm'

type RuneCardPreviewOverlayProps = {
  open: boolean
  mode: RuneCardPreviewMode
  card: HeldCard | null
  localPlayer: Player
  players: Player[]
  avatarsByPlayerId: Record<string, string | null | undefined>
  onCancel: () => void
  onPickLocation?: () => void
  onPickIdentity?: (playerId: string) => void
}

export function RuneCardPreviewOverlay({
  open,
  mode,
  card,
  localPlayer,
  players,
  avatarsByPlayerId,
  onCancel,
  onPickLocation,
  onPickIdentity,
}: RuneCardPreviewOverlayProps) {
  const titleId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    primaryRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open || !card) return null

  const label = RUNE_CARD_LABELS[card.cardType]
  const description = RUNE_CARD_DESCRIPTIONS[card.cardType]

  return (
    <div
      className="rune-card-preview-root"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="game-hud-backdrop" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="rune-card-preview-sheet"
      >
        <div className="rune-card-preview-art-wrap">
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

        {mode === 'confirm' ? (
          <div className="rune-card-preview-identities">
            <div className="rune-card-preview-avatar-row">
              {players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className={[
                    'rune-card-preview-avatar-btn',
                    player.id === localPlayer.id ? 'rune-card-preview-avatar-btn--self' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onPickIdentity?.(player.id)}
                  aria-label={player.name}
                >
                  <PlayerBadge
                    color={player.color}
                    avatarEmoji={avatarsByPlayerId[player.id]}
                    size="md"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rune-card-preview-actions">
          <button type="button" className="btn-leave rune-card-preview-btn" onClick={onCancel}>
            {mode === 'confirm' ? 'Quay lại' : 'Hủy'}
          </button>
          {mode === 'preview' ? (
            <button
              ref={primaryRef}
              type="button"
              className="game-btn btn-blue rune-card-preview-btn"
              onClick={onPickLocation}
            >
              Chọn vị trí
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
