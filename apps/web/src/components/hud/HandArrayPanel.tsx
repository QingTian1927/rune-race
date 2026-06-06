import { useEffect, useState } from 'react'
import type { HeldCard, PlayerColor } from '@rune-race/shared'
import { RUNE_MAX_HAND_SIZE } from '@rune-race/shared'
import { RUNE_CARD_DESCRIPTIONS, RUNE_CARD_IMAGES, RUNE_CARD_LABELS } from '../../lib/runeAssets'
import { HUD_PANEL_LABEL_CLASS, PLAYER_COLOR_MAP } from './playerColorStyles'
import { PanelCollapseButton } from './PanelCollapseButton'
import { useHandCardPress } from './useHandCardPress'

type HandArrayPanelProps = {
  hand: HeldCard[]
  pendingRewardCount: number
  drawCount: number
  selectedCardId: string | null
  onCardSelect: (heldCardId: string) => void
  onCardPreview: (heldCardId: string) => void
  canSelectCards?: boolean
  canDraw: boolean
  onDraw: () => void
  drawDisabledTitle?: string
  playerColor?: PlayerColor
  runeActionActive?: boolean
}

export function HandArrayPanel({
  hand,
  pendingRewardCount,
  drawCount,
  selectedCardId,
  onCardSelect,
  onCardPreview,
  canSelectCards = true,
  canDraw,
  onDraw,
  drawDisabledTitle,
  playerColor = 'blue',
  runeActionActive = false,
}: HandArrayPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const colorStyles = PLAYER_COLOR_MAP[playerColor]

  useEffect(() => {
    if (runeActionActive) {
      setCollapsed(false)
    }
  }, [runeActionActive])

  const showDrawSlot = canDraw || Boolean(drawDisabledTitle && runeActionActive)

  if (collapsed) {
    return (
      <div className="game-hud-slot game-hud-slot--hand game-hud-slot--hand-collapsed">
        <div className={['game-hud-panel game-hud-panel--collapsed rune-hand-panel', colorStyles.hudPanel].join(' ')}>
          <span className="rune-hand-collapsed-icon" aria-hidden>
            🃏
          </span>
          <span className="game-hud-label">{hand.length}/{RUNE_MAX_HAND_SIZE}</span>
          {pendingRewardCount > 0 ? (
            <span className="rune-hand-reward-pill">+{pendingRewardCount}</span>
          ) : null}
          <PanelCollapseButton
            collapsed={collapsed}
            expandDirection="right"
            onClick={() => setCollapsed(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="game-hud-slot game-hud-slot--hand">
      <div className={['game-hud-panel rune-hand-panel', colorStyles.hudPanel].join(' ')}>
        <div className="game-hud-row rune-hand-header">
          <div className="rune-hand-title">
            <p className={HUD_PANEL_LABEL_CLASS}>THẺ RUNE</p>
            <p className="game-hud-name rune-hand-meta">
              {hand.length}/{RUNE_MAX_HAND_SIZE}
              <span className="rune-hand-meta-sep" aria-hidden>
                ·
              </span>
              {drawCount}/25
              {pendingRewardCount > 0 ? (
                <span className="rune-hand-reward-pill">+{pendingRewardCount}</span>
              ) : null}
            </p>
          </div>
          <PanelCollapseButton
            collapsed={collapsed}
            expandDirection="right"
            onClick={() => setCollapsed(true)}
            className="game-hud-collapse-end"
          />
        </div>

        <div
          className={[
            'rune-hand-body',
            hand.length === 0 && showDrawSlot ? 'rune-hand-body--solo-draw' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="rune-hand-cards">
            {hand.map((card) => (
              <HandCardButton
                key={card.heldCardId}
                card={card}
                selected={selectedCardId === card.heldCardId}
                disabled={!canSelectCards}
                onSelect={() => onCardSelect(card.heldCardId)}
                onPreview={() => onCardPreview(card.heldCardId)}
              />
            ))}
          </div>

          {showDrawSlot ? (
            <div className="rune-hand-draw-slot">
              {canDraw ? (
                <button
                  type="button"
                  className="rune-hand-draw"
                  onClick={onDraw}
                  title="Bốc thẻ"
                  aria-label="Bốc thẻ"
                >
                  <i className="bi bi-plus-lg" aria-hidden="true" />
                </button>
              ) : (
                <div className="rune-hand-draw rune-hand-draw--disabled" title={drawDisabledTitle}>
                  <i className="bi bi-slash-circle" aria-hidden="true" />
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

type HandCardButtonProps = {
  card: HeldCard
  selected: boolean
  disabled: boolean
  onSelect: () => void
  onPreview: () => void
}

function HandCardButton({ card, selected, disabled, onSelect, onPreview }: HandCardButtonProps) {
  const pressHandlers = useHandCardPress(onSelect, onPreview, disabled)
  const label = RUNE_CARD_LABELS[card.cardType]
  const description = RUNE_CARD_DESCRIPTIONS[card.cardType]

  return (
    <button
      type="button"
      className={[
        'rune-hand-card',
        selected ? 'rune-hand-card--selected' : '',
        disabled ? 'rune-hand-card--disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      title={description}
      aria-label={label}
      {...pressHandlers}
    >
      <img src={RUNE_CARD_IMAGES[card.cardType]} alt="" className="rune-hand-card-img" />
      <span className="rune-hand-card-ttl">{card.remainingHandRounds}</span>
    </button>
  )
}
