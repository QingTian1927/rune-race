import { useId } from 'react'
import type { RuneCardType } from '@rune-race/shared'
import { RUNE_HONESTY_REWARD_TYPES } from '@rune-race/shared'
import {
  RUNE_CARD_DESCRIPTIONS,
  RUNE_CARD_IMAGES,
  RUNE_CARD_LABELS,
} from '../../lib/runeAssets'

type HonestyRewardOverlayProps = {
  open: boolean
  /** Ms until the placement window closes and the server picks at random; null hides the hint. */
  autoPickInMs: number | null
  onSelect: (cardType: RuneCardType) => void
  /** Hide the overlay to keep placing markers; reward stays claimable. */
  onDismiss: () => void
}

export function HonestyRewardOverlay({
  open,
  autoPickInMs,
  onSelect,
  onDismiss,
}: HonestyRewardOverlayProps) {
  const titleId = useId()

  if (!open) return null

  const autoPickSeconds =
    autoPickInMs !== null ? Math.max(0, Math.ceil(autoPickInMs / 1000)) : null

  return (
    <div className="rune-card-preview-root rune-card-preview-root--reward" role="presentation">
      <div className="game-hud-backdrop" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="rune-card-preview-sheet rune-reward-sheet"
      >
        <p className="rune-card-preview-kicker">Phần thưởng chuỗi trung thực</p>

        <div className="rune-card-preview-copy">
          <h2 id={titleId} className="rune-card-preview-title">
            Chọn 1 thẻ hỗ trợ
          </h2>
          <p className="rune-card-preview-desc">
            5 lượt đặt thẻ chính danh liên tiếp — thẻ được thêm thẳng vào tay, kể cả khi đã đủ 5 thẻ.
          </p>
        </div>

        <div className="rune-reward-choices">
          {RUNE_HONESTY_REWARD_TYPES.map((cardType) => (
            <button
              key={cardType}
              type="button"
              className="rune-reward-choice"
              title={RUNE_CARD_DESCRIPTIONS[cardType]}
              onClick={() => onSelect(cardType)}
            >
              <img src={RUNE_CARD_IMAGES[cardType]} alt="" className="rune-reward-choice-img" />
              <span className="rune-reward-choice-label">{RUNE_CARD_LABELS[cardType]}</span>
            </button>
          ))}
        </div>

        {autoPickSeconds !== null ? (
          <p className="rune-reward-timeout" role="status" aria-live="polite">
            Hết giờ sẽ nhận ngẫu nhiên sau {autoPickSeconds}s
          </p>
        ) : null}

        <div className="rune-card-preview-actions rune-card-preview-actions--single">
          <button
            type="button"
            className="game-btn btn-outline rune-card-preview-btn"
            onClick={onDismiss}
          >
            Chọn sau
          </button>
        </div>
      </div>
    </div>
  )
}
