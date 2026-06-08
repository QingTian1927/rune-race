import { useEffect, useState } from 'react'
import type { HeldCard, PlayerColor } from '@rune-race/shared'
import { RUNE_MAX_DRAW_PER_PLAYER, RUNE_MAX_HAND_SIZE } from '@rune-race/shared'
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
  isCardSelectable?: (card: HeldCard) => boolean
  getCardDisabledTitle?: (card: HeldCard) => string | undefined
  isCardPending?: (card: HeldCard) => boolean
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
  isCardSelectable,
  getCardDisabledTitle,
  isCardPending,
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

  const showDrawSlot =
    canDraw ||
    Boolean(
      runeActionActive &&
        drawDisabledTitle &&
        drawDisabledTitle !== 'Tay đầy',
    )

  if (collapsed) {
    return (
      <div className="game-hud-slot game-hud-slot--hand game-hud-slot--hand-collapsed">
        <div
          key="collapsed"
          className={['game-hud-panel game-hud-panel--collapsed rune-hand-panel game-hud-panel--motion', colorStyles.hudPanel].join(' ')}
        >
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

  const handMeta = (
    <>
      {hand.length}/{RUNE_MAX_HAND_SIZE}
      <span className="rune-hand-meta-sep" aria-hidden>
        ·
      </span>
      {drawCount}/{RUNE_MAX_DRAW_PER_PLAYER}
      {pendingRewardCount > 0 ? (
        <span className="rune-hand-reward-pill">+{pendingRewardCount}</span>
      ) : null}
    </>
  )

  const collapseButton = (
    <PanelCollapseButton
      collapsed={collapsed}
      expandDirection="right"
      onClick={() => setCollapsed(true)}
      className="game-hud-collapse-end"
    />
  )

  const drawSlot = showDrawSlot ? (
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
  ) : null

  if (hand.length === 0) {
    return (
      <div className="game-hud-slot game-hud-slot--hand">
        <div
          key="empty"
          className={['game-hud-panel rune-hand-panel rune-hand-panel--empty game-hud-panel--motion', colorStyles.hudPanel]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="rune-hand-empty-row">
            <div className="rune-hand-title">
              <p className={HUD_PANEL_LABEL_CLASS}>THẺ RUNE</p>
              <p className="game-hud-name rune-hand-meta">{handMeta}</p>
            </div>
            <div className="rune-hand-empty-actions">
              {drawSlot}
              {collapseButton}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="game-hud-slot game-hud-slot--hand">
      <div
        key="expanded"
        className={[
          'game-hud-panel rune-hand-panel game-hud-panel--motion',
          hand.length >= RUNE_MAX_HAND_SIZE ? 'rune-hand-panel--full' : '',
          colorStyles.hudPanel,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="game-hud-row rune-hand-header">
          <div className="rune-hand-title">
            <p className={HUD_PANEL_LABEL_CLASS}>THẺ RUNE</p>
            <p className="game-hud-name rune-hand-meta">{handMeta}</p>
          </div>
          {collapseButton}
        </div>

        <div className="rune-hand-body">
          <div className="rune-hand-cards">
            {hand.map((card) => {
              const selectable = isCardSelectable ? isCardSelectable(card) : canSelectCards
              const pending = isCardPending?.(card) ?? false
              const disabledTitle = !selectable && !pending ? getCardDisabledTitle?.(card) : undefined
              return (
                <HandCardButton
                  key={card.heldCardId}
                  card={card}
                  selected={selectedCardId === card.heldCardId}
                  disabled={!selectable && !pending}
                  disabledTitle={disabledTitle}
                  pending={pending}
                  onSelect={() => onCardSelect(card.heldCardId)}
                  onPreview={() => onCardPreview(card.heldCardId)}
                />
              )
            })}
          </div>
          {drawSlot}
        </div>
      </div>
    </div>
  )
}

type HandCardButtonProps = {
  card: HeldCard
  selected: boolean
  disabled: boolean
  disabledTitle?: string
  pending?: boolean
  onSelect: () => void
  onPreview: () => void
}

function HandCardButton({
  card,
  selected,
  disabled,
  disabledTitle,
  pending = false,
  onSelect,
  onPreview,
}: HandCardButtonProps) {
  const pressHandlers = useHandCardPress(onSelect, onPreview, disabled)
  const label = RUNE_CARD_LABELS[card.cardType]
  const description = RUNE_CARD_DESCRIPTIONS[card.cardType]

  return (
    <button
      type="button"
      className={[
        'rune-hand-card',
        selected ? 'rune-hand-card--selected' : '',
        pending ? 'rune-hand-card--pending' : '',
        disabled ? 'rune-hand-card--disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      title={disabledTitle ?? description}
      aria-label={label}
      {...pressHandlers}
    >
      <img src={RUNE_CARD_IMAGES[card.cardType]} alt="" className="rune-hand-card-img" />
      <span className="rune-hand-card-ttl">{card.remainingHandRounds}</span>
    </button>
  )
}
